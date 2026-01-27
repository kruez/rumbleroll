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
    const { entryNumber, wrestlerName, eliminatedBy, isWinner } = await request.json();

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
      wrestlerName?: string;
      enteredAt?: Date;
      eliminatedBy?: string | null;
      eliminatedAt?: Date | null;
      isWinner?: boolean;
    } = {};

    // If setting wrestler name for the first time, set enteredAt
    if (wrestlerName !== undefined) {
      updateData.wrestlerName = wrestlerName;
      if (wrestlerName && !entry.enteredAt) {
        updateData.enteredAt = new Date();
      }
    }

    // If marking as eliminated
    if (eliminatedBy !== undefined) {
      updateData.eliminatedBy = eliminatedBy || null;
      updateData.eliminatedAt = eliminatedBy ? new Date() : null;
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

    return NextResponse.json(updatedEntry);
  } catch (error) {
    console.error("Error updating entry:", error);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}
