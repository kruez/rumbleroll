import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/parties/[id]/participants/[participantId] - Remove participant (host only, lobby status only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, participantId } = await params;

    const party = await prisma.party.findUnique({
      where: { id },
      include: {
        participants: true,
      },
    });

    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    // Only host can remove participants
    if (party.hostId !== session.user.id) {
      return NextResponse.json({ error: "Only the host can remove participants" }, { status: 403 });
    }

    // Can only remove participants in lobby status
    if (party.status !== "LOBBY") {
      return NextResponse.json({ error: "Can only remove participants before numbers are distributed" }, { status: 400 });
    }

    // Find the participant
    const participant = party.participants.find(p => p.id === participantId);
    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    // Cannot remove self (host)
    if (participant.userId === session.user.id) {
      return NextResponse.json({ error: "Cannot remove yourself from the party" }, { status: 400 });
    }

    // Delete the participant
    await prisma.partyParticipant.delete({
      where: { id: participantId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing participant:", error);
    return NextResponse.json({ error: "Failed to remove participant" }, { status: 500 });
  }
}
