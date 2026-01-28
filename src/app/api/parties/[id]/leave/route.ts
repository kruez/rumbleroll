import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/parties/[id]/leave - Leave a party (non-host, lobby status only)
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

    // Host cannot leave their own party
    if (party.hostId === session.user.id) {
      return NextResponse.json({ error: "Host cannot leave the party. Delete it instead." }, { status: 400 });
    }

    // Can only leave in lobby status
    if (party.status !== "LOBBY") {
      return NextResponse.json({ error: "Cannot leave after numbers have been distributed" }, { status: 400 });
    }

    // Find the participant record
    const participant = party.participants.find(p => p.userId === session.user.id);
    if (!participant) {
      return NextResponse.json({ error: "You are not a participant in this party" }, { status: 400 });
    }

    // Delete the participant
    await prisma.partyParticipant.delete({
      where: { id: participant.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error leaving party:", error);
    return NextResponse.json({ error: "Failed to leave party" }, { status: 500 });
  }
}
