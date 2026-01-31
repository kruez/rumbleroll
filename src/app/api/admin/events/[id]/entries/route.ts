import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/admin/events/[id]/entries - Update an entry
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;
    const { entryNumber, wrestlerName, wrestlerImageUrl, eliminatedBy, isWinner } = await request.json();

    if (!entryNumber || entryNumber < 1 || entryNumber > 30) {
      return NextResponse.json({ error: "Invalid entry number" }, { status: 400 });
    }

    // Find the entry
    const entry = await prisma.rumbleEntry.findUnique({
      where: {
        eventId_entryNumber: {
          eventId,
          entryNumber,
        },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // Build update data
    const updateData: {
      wrestlerName?: string | null;
      wrestlerImageUrl?: string | null;
      enteredAt?: Date | null;
      eliminatedBy?: string | null;
      eliminatedAt?: Date | null;
      isWinner?: boolean;
    } = {};

    // If setting wrestler name for the first time, set enteredAt
    // Only set enteredAt if event is IN_PROGRESS (not for pre-staging)
    // If clearing wrestler (null/empty), reset all entry fields
    if (wrestlerName !== undefined) {
      if (!wrestlerName || wrestlerName.trim() === "") {
        // Clearing the wrestler - reset all fields
        updateData.wrestlerName = null;
        updateData.wrestlerImageUrl = null;
        updateData.enteredAt = null;
        updateData.eliminatedBy = null;
        updateData.eliminatedAt = null;
        updateData.isWinner = false;
      } else {
        updateData.wrestlerName = wrestlerName;

        if (!entry.enteredAt) {
          const event = await prisma.rumbleEvent.findUnique({
            where: { id: eventId },
            select: { status: true },
          });

          if (event?.status === "IN_PROGRESS") {
            updateData.enteredAt = new Date();
          }
        }
      }
    }

    // Set wrestler image URL if provided
    if (wrestlerImageUrl !== undefined) {
      updateData.wrestlerImageUrl = wrestlerImageUrl;
    }

    // If marking as eliminated
    if (eliminatedBy !== undefined) {
      updateData.eliminatedBy = eliminatedBy || null;
      updateData.eliminatedAt = new Date();
    }

    // If declaring winner
    if (isWinner !== undefined) {
      updateData.isWinner = isWinner;
      // If marking as winner, ensure not eliminated
      if (isWinner) {
        updateData.eliminatedBy = null;
        updateData.eliminatedAt = null;

        // Also update event status to COMPLETED
        await prisma.rumbleEvent.update({
          where: { id: eventId },
          data: { status: "COMPLETED" },
        });
      }
    }

    const updatedEntry = await prisma.rumbleEntry.update({
      where: { id: entry.id },
      data: updateData,
    });

    // Check if auto-winner should be declared after elimination
    if (eliminatedBy !== undefined) {
      // Get all entries to check remaining active wrestlers
      const allEntries = await prisma.rumbleEntry.findMany({
        where: { eventId },
      });

      const activeEntries = allEntries.filter(
        (e) => e.wrestlerName && !e.eliminatedAt && !e.isWinner
      );

      // If only one wrestler remains and no winner yet, auto-declare winner
      if (activeEntries.length === 1) {
        const lastStanding = activeEntries[0];
        await prisma.rumbleEntry.update({
          where: { id: lastStanding.id },
          data: { isWinner: true },
        });
        await prisma.rumbleEvent.update({
          where: { id: eventId },
          data: { status: "COMPLETED" },
        });
      }
    }

    return NextResponse.json(updatedEntry);
  } catch (error) {
    console.error("Error updating entry:", error);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}
