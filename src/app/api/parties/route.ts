import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/utils/inviteCode";
import { distributeNumbers, DistributionMode } from "@/utils/numberDistribution";

// GET /api/parties - List user's parties (or all parties for an event if eventId is provided)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    // If eventId is provided and user is admin, return all parties for that event
    if (eventId && session.user.isAdmin) {
      const parties = await prisma.party.findMany({
        where: { eventId },
        select: { id: true, name: true },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(parties);
    }

    const parties = await prisma.party.findMany({
      where: {
        OR: [
          { hostId: session.user.id },
          { participants: { some: { userId: session.user.id } } },
        ],
      },
      include: {
        host: { select: { id: true, name: true, email: true } },
        event: { select: { id: true, name: true, year: true, status: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(parties);
  } catch (error) {
    console.error("Error fetching parties:", error);
    return NextResponse.json({ error: "Failed to fetch parties" }, { status: 500 });
  }
}

// POST /api/parties - Create a new party
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, eventId, hostParticipates = true, distributionMode = "EXCLUDE", entryFee } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Party name is required" }, { status: 400 });
    }

    if (!eventId) {
      return NextResponse.json({ error: "Event is required" }, { status: 400 });
    }

    // Verify event exists
    const event = await prisma.rumbleEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Generate unique invite code
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.party.findUnique({ where: { inviteCode } });
      if (!existing) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    const party = await prisma.party.create({
      data: {
        name,
        inviteCode,
        hostId: session.user.id,
        eventId,
        distributionMode,
        entryFee: entryFee ? parseFloat(entryFee) : null,
        // Only create participant record if host wants to participate
        ...(hostParticipates && {
          participants: {
            create: {
              userId: session.user.id,
            },
          },
        }),
      },
      include: {
        host: { select: { id: true, name: true, email: true } },
        event: { select: { id: true, name: true, year: true, status: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    // If event is already IN_PROGRESS and host is participating, auto-start the party
    if (event.status === "IN_PROGRESS" && hostParticipates) {
      const participants = await prisma.partyParticipant.findMany({
        where: { partyId: party.id },
      });

      // Only auto-start if there are eligible participants
      // For paid parties created during event (edge case), the host would need to be paid
      let eligibleParticipants = participants;
      if (entryFee && parseFloat(entryFee) > 0) {
        eligibleParticipants = participants.filter(p => p.hasPaid);
      }

      if (eligibleParticipants.length > 0) {
        const participantIds = eligibleParticipants.map(p => p.id);
        const mode = distributionMode as DistributionMode;
        const distribution = distributeNumbers(participantIds, mode);

        await prisma.$transaction(async (tx) => {
          const assignmentsData: {
            participantId: string;
            entryNumber: number;
            partyId: string;
            isShared: boolean;
            shareGroup: number | null;
          }[] = [];

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

          let shareGroupIndex = 0;
          distribution.shared.forEach((pIds, entryNumber) => {
            pIds.forEach(participantId => {
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

          await tx.numberAssignment.createMany({
            data: assignmentsData,
          });

          await tx.party.update({
            where: { id: party.id },
            data: { status: "NUMBERS_ASSIGNED" },
          });
        });

        // Refetch party with updated status
        const updatedParty = await prisma.party.findUnique({
          where: { id: party.id },
          include: {
            host: { select: { id: true, name: true, email: true } },
            event: { select: { id: true, name: true, year: true, status: true } },
            participants: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        });

        return NextResponse.json(updatedParty);
      }
    }

    return NextResponse.json(party);
  } catch (error) {
    console.error("Error creating party:", error);
    return NextResponse.json({ error: "Failed to create party" }, { status: 500 });
  }
}
