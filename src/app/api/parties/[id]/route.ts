import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/parties/[id] - Get party details
export async function GET(
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
        host: { select: { id: true, name: true, email: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            assignments: {
              include: {
                entry: true,
              },
            },
          },
        },
        entries: {
          orderBy: { entryNumber: "asc" },
        },
      },
    });

    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    // Check if user is part of the party
    const isParticipant = party.participants.some(p => p.userId === session.user.id);
    const isHost = party.hostId === session.user.id;

    if (!isParticipant && !isHost) {
      return NextResponse.json({ error: "Not a party member" }, { status: 403 });
    }

    return NextResponse.json({ ...party, isHost });
  } catch (error) {
    console.error("Error fetching party:", error);
    return NextResponse.json({ error: "Failed to fetch party" }, { status: 500 });
  }
}

// DELETE /api/parties/[id] - Delete party (host only)
export async function DELETE(
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
    });

    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    if (party.hostId !== session.user.id) {
      return NextResponse.json({ error: "Only the host can delete the party" }, { status: 403 });
    }

    await prisma.party.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting party:", error);
    return NextResponse.json({ error: "Failed to delete party" }, { status: 500 });
  }
}
