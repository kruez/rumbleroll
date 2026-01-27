import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/utils/inviteCode";

// GET /api/parties - List user's parties
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const { name, eventName } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Party name is required" }, { status: 400 });
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
        eventName: eventName || "Royal Rumble 2025",
        inviteCode,
        hostId: session.user.id,
        participants: {
          create: {
            userId: session.user.id,
          },
        },
      },
      include: {
        host: { select: { id: true, name: true, email: true } },
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
