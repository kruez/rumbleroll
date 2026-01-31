import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/utils/inviteCode";

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

    return NextResponse.json(party);
  } catch (error) {
    console.error("Error creating party:", error);
    return NextResponse.json({ error: "Failed to create party" }, { status: 500 });
  }
}
