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

    // When entry fee is set, only include paid participants
    let eligibleParticipants = party.participants;
    if (party.entryFee && party.entryFee > 0) {
      eligibleParticipants = party.participants.filter(p => p.hasPaid);
      if (eligibleParticipants.length === 0) {
        return NextResponse.json({
          error: "No paid participants. Mark at least one participant as paid before starting."
        }, { status: 400 });
      }
    }

    // Distribute numbers only to eligible participants
    const participantIds = eligibleParticipants.map(p => p.id);
    const distribution = distributeNumbers(participantIds);

    // Create assignments in a transaction
    await prisma.$transaction(async (tx) => {
      // Build all assignment data
      const assignmentsData: { participantId: string; entryNumber: number; partyId: string }[] = [];
      distribution.forEach((numbers, participantId) => {
        numbers.forEach(num => {
          assignmentsData.push({
            participantId,
            entryNumber: num,
            partyId: party.id,
          });
        });
      });

      // Create all assignments at once
      await tx.numberAssignment.createMany({
        data: assignmentsData,
      });

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
