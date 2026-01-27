import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/parties/join - Join a party via invite code
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inviteCode } = await request.json();

    if (!inviteCode) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    const party = await prisma.party.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
      include: {
        participants: true,
      },
    });

    if (!party) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    // Check if already a participant
    const existingParticipant = party.participants.find(p => p.userId === session.user.id);
    if (existingParticipant) {
      return NextResponse.json({ partyId: party.id, alreadyJoined: true });
    }

    // Check if numbers have already been assigned
    if (party.status !== "LOBBY") {
      return NextResponse.json(
        { error: "This party has already started. Numbers have been assigned." },
        { status: 400 }
      );
    }

    // Join the party
    await prisma.partyParticipant.create({
      data: {
        partyId: party.id,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ partyId: party.id, joined: true });
  } catch (error) {
    console.error("Error joining party:", error);
    return NextResponse.json({ error: "Failed to join party" }, { status: 500 });
  }
}
