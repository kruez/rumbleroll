import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { distributeNumbers, DistributionMode } from "@/utils/numberDistribution";

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

    // Distribute numbers only to eligible participants using the party's distribution mode
    const participantIds = eligibleParticipants.map(p => p.id);
    const mode = party.distributionMode as DistributionMode;
    const distribution = distributeNumbers(participantIds, mode);

    // Create assignments in a transaction
    await prisma.$transaction(async (tx) => {
      // Build all assignment data
      const assignmentsData: {
        participantId: string;
        entryNumber: number;
        partyId: string;
        isShared: boolean;
        shareGroup: number | null;
      }[] = [];

      // Add owned (non-shared) assignments
      distribution.owned.forEach((numbers, participantId) => {
        numbers.forEach(num => {
          assignmentsData.push({
            participantId,
            entryNumber: num,
            partyId: party.id,
            isShared: false,
            shareGroup: null,
          });
        });
      });

      // Add shared assignments (for SHARED mode)
      let shareGroupIndex = 0;
      distribution.shared.forEach((participantIds, entryNumber) => {
        participantIds.forEach(participantId => {
          assignmentsData.push({
            participantId,
            entryNumber,
            partyId: party.id,
            isShared: true,
            shareGroup: shareGroupIndex,
          });
        });
        shareGroupIndex++;
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

    // Return info about the distribution
    const numParticipants = eligibleParticipants.length;
    const baseCount = Math.floor(30 / numParticipants);
    const remainder = 30 % numParticipants;

    return NextResponse.json({
      success: true,
      mode,
      numbersPerPerson: baseCount,
      unassignedCount: mode === "EXCLUDE" || mode === "BUY_EXTRA" ? remainder : 0,
      sharedCount: mode === "SHARED" ? remainder : 0,
    });
  } catch (error) {
    console.error("Error distributing numbers:", error);
    return NextResponse.json({ error: "Failed to distribute numbers" }, { status: 500 });
  }
}
