import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/parties/[id]/entries - Update an entry (host only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { entryNumber, wrestlerName, eliminatedBy, isWinner } = body;

    const party = await prisma.party.findUnique({
      where: { id },
    });

    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    if (party.hostId !== session.user.id) {
      return NextResponse.json({ error: "Only the host can update entries" }, { status: 403 });
    }

    const entry = await prisma.rumbleEntry.findUnique({
      where: {
        partyId_entryNumber: {
          partyId: id,
          entryNumber: entryNumber,
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
      eliminatedAt?: Date | null;
      eliminatedBy?: string | null;
      isWinner?: boolean;
    } = {};

    // Set wrestler name (entry into ring)
    if (wrestlerName !== undefined) {
      updateData.wrestlerName = wrestlerName;
      if (wrestlerName && !entry.enteredAt) {
        updateData.enteredAt = new Date();
      }

      // Update party status to IN_PROGRESS if setting first wrestler
      if (wrestlerName && party.status === "NUMBERS_ASSIGNED") {
        await prisma.party.update({
          where: { id },
          data: { status: "IN_PROGRESS" },
        });
      }
    }

    // Handle elimination
    if (eliminatedBy !== undefined) {
      if (eliminatedBy) {
        updateData.eliminatedAt = new Date();
        updateData.eliminatedBy = eliminatedBy;
      } else {
        // Undo elimination
        updateData.eliminatedAt = null;
        updateData.eliminatedBy = null;
      }
    }

    // Handle winner
    if (isWinner !== undefined) {
      updateData.isWinner = isWinner;
      if (isWinner) {
        // Mark party as completed
        await prisma.party.update({
          where: { id },
          data: { status: "COMPLETED" },
        });
      }
    }

    const updatedEntry = await prisma.rumbleEntry.update({
      where: { id: entry.id },
      data: updateData,
      include: {
        assignment: {
          include: {
            participant: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedEntry);
  } catch (error) {
    console.error("Error updating entry:", error);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}
