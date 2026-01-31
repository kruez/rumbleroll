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
        host: { select: { id: true, name: true, email: true, venmoHandle: true, cashAppHandle: true } },
        event: {
          include: {
            entries: { orderBy: { entryNumber: "asc" } },
          },
        },
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, venmoHandle: true, cashAppHandle: true, profileImageUrl: true } },
          },
        },
        assignments: true,
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

    // Transform data to include assignments with each participant
    const participantsWithAssignments = party.participants.map(p => ({
      id: p.id,
      userId: p.userId,
      joinedAt: p.joinedAt,
      hasPaid: p.hasPaid,
      paidAt: p.paidAt,
      user: p.user,
      assignments: party.assignments
        .filter(a => a.participantId === p.id)
        .map(a => ({
          id: a.id,
          entryNumber: a.entryNumber,
          isShared: a.isShared,
          shareGroup: a.shareGroup,
        })),
    }));

    // Compute unassigned numbers (for EXCLUDE and BUY_EXTRA modes)
    const assignedNumbers = new Set(party.assignments.map(a => a.entryNumber));
    const unassignedNumbers: number[] = [];
    for (let i = 1; i <= 30; i++) {
      if (!assignedNumbers.has(i)) {
        unassignedNumbers.push(i);
      }
    }

    // Compute shared assignments (for SHARED mode) - group by entry number
    const sharedAssignments: { entryNumber: number; participantIds: string[]; shareGroup: number }[] = [];
    if (party.distributionMode === "SHARED") {
      const sharedByEntry = new Map<number, { participantIds: string[]; shareGroup: number }>();
      party.assignments
        .filter(a => a.isShared && a.shareGroup !== null)
        .forEach(a => {
          if (!sharedByEntry.has(a.entryNumber)) {
            sharedByEntry.set(a.entryNumber, { participantIds: [], shareGroup: a.shareGroup! });
          }
          sharedByEntry.get(a.entryNumber)!.participantIds.push(a.participantId);
        });
      sharedByEntry.forEach((data, entryNumber) => {
        sharedAssignments.push({ entryNumber, ...data });
      });
    }

    return NextResponse.json({
      id: party.id,
      name: party.name,
      inviteCode: party.inviteCode,
      status: party.status,
      distributionMode: party.distributionMode,
      entryFee: party.entryFee,
      hostId: party.hostId,
      host: party.host,
      event: party.event,
      participants: participantsWithAssignments,
      unassignedNumbers,
      sharedAssignments,
      isHost,
    });
  } catch (error) {
    console.error("Error fetching party:", error);
    return NextResponse.json({ error: "Failed to fetch party" }, { status: 500 });
  }
}

// PATCH /api/parties/[id] - Update party settings (host only, LOBBY status only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { distributionMode } = body;

    // Validate distributionMode
    const validModes = ["EXCLUDE", "BUY_EXTRA", "SHARED"];
    if (!distributionMode || !validModes.includes(distributionMode)) {
      return NextResponse.json(
        { error: "Invalid distribution mode" },
        { status: 400 }
      );
    }

    const party = await prisma.party.findUnique({
      where: { id },
    });

    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    if (party.hostId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the host can update party settings" },
        { status: 403 }
      );
    }

    if (party.status !== "LOBBY") {
      return NextResponse.json(
        { error: "Can only change settings before the party starts" },
        { status: 400 }
      );
    }

    const updatedParty = await prisma.party.update({
      where: { id },
      data: { distributionMode },
    });

    return NextResponse.json({
      id: updatedParty.id,
      distributionMode: updatedParty.distributionMode,
    });
  } catch (error) {
    console.error("Error updating party:", error);
    return NextResponse.json({ error: "Failed to update party" }, { status: 500 });
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
