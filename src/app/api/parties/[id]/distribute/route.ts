import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { distributeNumbers } from "@/utils/numberDistribution";

// POST /api/parties/[id]/distribute - Distribute numbers to participants (host only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const party = await prisma.party.findUnique({
      where: { id },
      include: {
        participants: true,
      },
    });

    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    if (party.hostId !== session.user.id) {
      return NextResponse.json({ error: "Only the host can distribute numbers" }, { status: 403 });
    }

    if (party.status !== "LOBBY") {
      return NextResponse.json({ error: "Numbers have already been distributed" }, { status: 400 });
    }

    if (party.participants.length === 0) {
      return NextResponse.json({ error: "No participants to distribute numbers to" }, { status: 400 });
    }

    // Distribute numbers
    const participantIds = party.participants.map(p => p.id);
    const distribution = distributeNumbers(participantIds);

    // Create entries and assignments in a transaction
    await prisma.$transaction(async (tx) => {
      // Create all 30 RumbleEntry records
      await tx.rumbleEntry.createMany({
        data: Array.from({ length: 30 }, (_, i) => ({
          partyId: party.id,
          entryNumber: i + 1,
        })),
      });

      // Get the created entries
      const entries = await tx.rumbleEntry.findMany({
        where: { partyId: party.id },
      });

      // Create number assignments
      const assignments: { participantId: string; entryNumber: number }[] = [];
      distribution.forEach((numbers, participantId) => {
        numbers.forEach(num => {
          assignments.push({ participantId, entryNumber: num });
        });
      });

      // Create assignments
      for (const assignment of assignments) {
        const entry = entries.find(e => e.entryNumber === assignment.entryNumber);
        await tx.numberAssignment.create({
          data: {
            participantId: assignment.participantId,
            entryNumber: assignment.entryNumber,
            entry: entry ? { connect: { id: entry.id } } : undefined,
          },
        });

        // Update the entry with the assignment
        if (entry) {
          const createdAssignment = await tx.numberAssignment.findFirst({
            where: {
              participantId: assignment.participantId,
              entryNumber: assignment.entryNumber,
            },
          });
          if (createdAssignment) {
            await tx.rumbleEntry.update({
              where: { id: entry.id },
              data: { assignmentId: createdAssignment.id },
            });
          }
        }
      }

      // Update party status
      await tx.party.update({
        where: { id: party.id },
        data: { status: "NUMBERS_ASSIGNED" },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error distributing numbers:", error);
    return NextResponse.json({ error: "Failed to distribute numbers" }, { status: 500 });
  }
}
