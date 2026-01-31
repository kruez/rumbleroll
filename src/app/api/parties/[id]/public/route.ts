import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/parties/[id]/public?code={inviteCode} - Get public party data for spectators
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Invite code required" }, { status: 400 });
    }

    const party = await prisma.party.findUnique({
      where: { id },
      include: {
        host: { select: { id: true, name: true } },
        event: {
          include: {
            entries: { orderBy: { entryNumber: "asc" } },
          },
        },
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, profileImageUrl: true } },
          },
        },
        assignments: true,
      },
    });

    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    // Validate invite code
    if (party.inviteCode !== code) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 403 });
    }

    // Transform data to include assignments with each participant
    // Sanitize user data for public view (hide email domain for privacy)
    const participantsWithAssignments = party.participants.map(p => ({
      id: p.id,
      hasPaid: p.hasPaid,
      user: {
        id: p.user.id,
        name: p.user.name || p.user.email.split("@")[0],
        profileImageUrl: p.user.profileImageUrl,
      },
      assignments: party.assignments
        .filter(a => a.participantId === p.id)
        .map(a => ({
          id: a.id,
          entryNumber: a.entryNumber,
        })),
    }));

    // Return sanitized public data (no payment handles, no full emails)
    return NextResponse.json({
      id: party.id,
      name: party.name,
      status: party.status,
      entryFee: party.entryFee,
      hostId: party.hostId,
      host: {
        id: party.host.id,
        name: party.host.name,
      },
      event: {
        id: party.event.id,
        name: party.event.name,
        year: party.event.year,
        status: party.event.status,
        entries: party.event.entries,
      },
      participants: participantsWithAssignments,
    });
  } catch (error) {
    console.error("Error fetching public party data:", error);
    return NextResponse.json({ error: "Failed to fetch party" }, { status: 500 });
  }
}
