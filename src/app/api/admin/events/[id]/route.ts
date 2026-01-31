import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { distributeNumbers, DistributionMode } from "@/utils/numberDistribution";

/**
 * Auto-starts a party by distributing numbers to eligible participants.
 * This is called when an event transitions to IN_PROGRESS.
 */
async function autoStartParty(partyId: string): Promise<{ success: boolean; error?: string }> {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: { participants: true },
  });

  if (!party || party.status !== "LOBBY") {
    return { success: false, error: "Party not in LOBBY status" };
  }

  if (party.participants.length === 0) {
    // Skip empty parties
    return { success: false, error: "No participants" };
  }

  // When entry fee is set, only include paid participants
  let eligibleParticipants = party.participants;
  if (party.entryFee && party.entryFee > 0) {
    eligibleParticipants = party.participants.filter(p => p.hasPaid);
    if (eligibleParticipants.length === 0) {
      // Skip if no paid participants
      return { success: false, error: "No paid participants" };
    }
  }

  // Distribute numbers only to eligible participants using the party's distribution mode
  const participantIds = eligibleParticipants.map(p => p.id);
  const mode = party.distributionMode as DistributionMode;
  const distribution = distributeNumbers(participantIds, mode);

  // Create assignments in a transaction
  await prisma.$transaction(async (tx) => {
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

  return { success: true };
}

// GET /api/admin/events/[id] - Get event details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const event = await prisma.rumbleEvent.findUnique({
      where: { id },
      include: {
        entries: { orderBy: { entryNumber: "asc" } },
        _count: { select: { parties: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}

// PATCH /api/admin/events/[id] - Update event status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { status } = await request.json();

    // Get current event state to check if we're starting the event
    const currentEvent = await prisma.rumbleEvent.findUnique({
      where: { id },
      select: { status: true },
    });

    // If transitioning from NOT_STARTED to IN_PROGRESS, start timers for any staged wrestlers
    if (status === "IN_PROGRESS" && currentEvent?.status === "NOT_STARTED") {
      await prisma.rumbleEntry.updateMany({
        where: {
          eventId: id,
          wrestlerName: { not: null },
          enteredAt: null,
        },
        data: { enteredAt: new Date() },
      });

      // Auto-start all LOBBY parties for this event
      const lobbyParties = await prisma.party.findMany({
        where: { eventId: id, status: "LOBBY" },
        select: { id: true, name: true },
      });

      const autoStartResults: { partyId: string; name: string; success: boolean; error?: string }[] = [];
      for (const party of lobbyParties) {
        const result = await autoStartParty(party.id);
        autoStartResults.push({ partyId: party.id, name: party.name, ...result });
      }

      console.log(`Auto-started ${autoStartResults.filter(r => r.success).length}/${lobbyParties.length} parties for event ${id}`, autoStartResults);
    }

    // If transitioning to COMPLETED, auto-complete all NUMBERS_ASSIGNED parties
    if (status === "COMPLETED" && currentEvent?.status !== "COMPLETED") {
      const result = await prisma.party.updateMany({
        where: { eventId: id, status: "NUMBERS_ASSIGNED" },
        data: { status: "COMPLETED" },
      });
      console.log(`Auto-completed ${result.count} parties for event ${id}`);
    }

    const event = await prisma.rumbleEvent.update({
      where: { id },
      data: { status },
      include: {
        entries: { orderBy: { entryNumber: "asc" } },
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

// DELETE /api/admin/events/[id] - Delete event
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";

    // Check if any parties are using this event
    const partiesCount = await prisma.party.count({
      where: { eventId: id },
    });

    if (partiesCount > 0) {
      // Get the event to check if it's a test event
      const event = await prisma.rumbleEvent.findUnique({
        where: { id },
        select: { isTest: true },
      });

      if (event?.isTest || force) {
        // For test events or force delete, cascade delete all associated parties
        await prisma.party.deleteMany({ where: { eventId: id } });
      } else {
        return NextResponse.json(
          { error: "Cannot delete event with active parties. Use force=true to override.", partiesCount },
          { status: 400 }
        );
      }
    }

    await prisma.rumbleEvent.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
