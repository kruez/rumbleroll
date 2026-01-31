import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/parties/[id]/extras - Get unassigned numbers (for BUY_EXTRA mode)
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
        assignments: true,
      },
    });

    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    // Only hosts can view unassigned numbers for assignment
    if (party.hostId !== session.user.id) {
      return NextResponse.json({ error: "Only the host can view extra numbers" }, { status: 403 });
    }

    if (party.distributionMode !== "BUY_EXTRA") {
      return NextResponse.json({ error: "This party does not use BUY_EXTRA mode" }, { status: 400 });
    }

    // Find all assigned entry numbers
    const assignedNumbers = new Set(party.assignments.map(a => a.entryNumber));

    // Find unassigned numbers (1-30 minus assigned)
    const unassignedNumbers: number[] = [];
    for (let i = 1; i <= 30; i++) {
      if (!assignedNumbers.has(i)) {
        unassignedNumbers.push(i);
      }
    }

    return NextResponse.json({ unassignedNumbers });
  } catch (error) {
    console.error("Error fetching extra numbers:", error);
    return NextResponse.json({ error: "Failed to fetch extra numbers" }, { status: 500 });
  }
}

// POST /api/parties/[id]/extras - Assign an extra number to a participant (host only)
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
    const { entryNumber, participantId } = await request.json();

    if (!entryNumber || !participantId) {
      return NextResponse.json({ error: "entryNumber and participantId are required" }, { status: 400 });
    }

    const party = await prisma.party.findUnique({
      where: { id },
      include: {
        assignments: true,
        participants: true,
      },
    });

    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    if (party.hostId !== session.user.id) {
      return NextResponse.json({ error: "Only the host can assign extra numbers" }, { status: 403 });
    }

    if (party.distributionMode !== "BUY_EXTRA") {
      return NextResponse.json({ error: "This party does not use BUY_EXTRA mode" }, { status: 400 });
    }

    if (party.status !== "NUMBERS_ASSIGNED") {
      return NextResponse.json({ error: "Numbers must be distributed first" }, { status: 400 });
    }

    // Validate entry number is in range
    if (entryNumber < 1 || entryNumber > 30) {
      return NextResponse.json({ error: "Entry number must be between 1 and 30" }, { status: 400 });
    }

    // Check if this number is already assigned
    const existingAssignment = party.assignments.find(a => a.entryNumber === entryNumber);
    if (existingAssignment) {
      return NextResponse.json({ error: "This number is already assigned" }, { status: 400 });
    }

    // Validate participant exists in this party
    const participant = party.participants.find(p => p.id === participantId);
    if (!participant) {
      return NextResponse.json({ error: "Participant not found in this party" }, { status: 400 });
    }

    // Create the assignment
    const assignment = await prisma.numberAssignment.create({
      data: {
        entryNumber,
        participantId,
        partyId: party.id,
        isShared: false,
        shareGroup: null,
      },
    });

    return NextResponse.json({
      success: true,
      assignment: {
        id: assignment.id,
        entryNumber: assignment.entryNumber,
        participantId: assignment.participantId,
      },
    });
  } catch (error) {
    console.error("Error assigning extra number:", error);
    return NextResponse.json({ error: "Failed to assign extra number" }, { status: 500 });
  }
}

// DELETE /api/parties/[id]/extras - Remove an extra number assignment (host only)
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
    const { searchParams } = new URL(request.url);
    const entryNumber = parseInt(searchParams.get("entryNumber") || "0");

    if (!entryNumber) {
      return NextResponse.json({ error: "entryNumber is required" }, { status: 400 });
    }

    const party = await prisma.party.findUnique({
      where: { id },
      include: {
        assignments: true,
      },
    });

    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    if (party.hostId !== session.user.id) {
      return NextResponse.json({ error: "Only the host can remove extra number assignments" }, { status: 403 });
    }

    if (party.distributionMode !== "BUY_EXTRA") {
      return NextResponse.json({ error: "This party does not use BUY_EXTRA mode" }, { status: 400 });
    }

    // Find the assignment
    const assignment = party.assignments.find(a => a.entryNumber === entryNumber);
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Check if this was an "extra" assignment (assigned after initial distribution)
    // For now, we'll allow removing any assignment in BUY_EXTRA mode
    // A more robust implementation would track which assignments were "extras"

    await prisma.numberAssignment.delete({
      where: { id: assignment.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing extra number assignment:", error);
    return NextResponse.json({ error: "Failed to remove extra number assignment" }, { status: 500 });
  }
}
