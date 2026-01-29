import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/utils/inviteCode";

// Generate test player names dynamically based on count
function getTestPlayerNames(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Test Player ${i + 1}`);
}

// GET /api/admin/events - List all events
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const events = await prisma.rumbleEvent.findMany({
      include: {
        _count: { select: { parties: true, entries: true } },
      },
      orderBy: { year: "desc" },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

// POST /api/admin/events - Create a new event
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, isTest, playerCount: rawPlayerCount } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Default year to current year
    const year = new Date().getFullYear();

    // Validate player count for test events (1-30, default 3)
    const playerCount = isTest ? Math.min(30, Math.max(1, rawPlayerCount || 3)) : 3;

    // Create event with 30 blank entries
    const event = await prisma.rumbleEvent.create({
      data: {
        name,
        year,
        isTest: isTest || false,
        entries: {
          createMany: {
            data: Array.from({ length: 30 }, (_, i) => ({
              entryNumber: i + 1,
            })),
          },
        },
      },
      include: {
        entries: { orderBy: { entryNumber: "asc" } },
      },
    });

    // If this is a test simulation, set up the test environment
    if (isTest) {
      // Generate unique invite code
      let inviteCode = generateInviteCode();
      let attempts = 0;
      while (attempts < 10) {
        const existing = await prisma.party.findUnique({ where: { inviteCode } });
        if (!existing) break;
        inviteCode = generateInviteCode();
        attempts++;
      }

      // Create test party with 5 test users
      const testParty = await prisma.party.create({
        data: {
          name: `Test Party - ${name}`,
          inviteCode,
          hostId: session.user.id,
          eventId: event.id,
          status: "NUMBERS_ASSIGNED",
        },
      });

      // Create test users if they don't exist, then add as participants
      const testPlayerNames = getTestPlayerNames(playerCount);
      const testUsers = [];
      for (const playerName of testPlayerNames) {
        const email = `${playerName.toLowerCase().replace(/\s+/g, "")}@test.local`;
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name: playerName,
              password: "test-password-not-for-login", // Not a real login
            },
          });
        }
        testUsers.push(user);

        // Add as participant
        await prisma.partyParticipant.create({
          data: {
            partyId: testParty.id,
            userId: user.id,
          },
        });
      }

      // Get all participants
      const participants = await prisma.partyParticipant.findMany({
        where: { partyId: testParty.id },
      });

      // Distribute numbers (6 numbers per player for 5 players = 30 numbers)
      const numbers = Array.from({ length: 30 }, (_, i) => i + 1);
      // Shuffle numbers
      for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
      }

      // Assign numbers round-robin style
      for (let i = 0; i < numbers.length; i++) {
        const participant = participants[i % participants.length];
        await prisma.numberAssignment.create({
          data: {
            entryNumber: numbers[i],
            participantId: participant.id,
            partyId: testParty.id,
          },
        });
      }

      return NextResponse.json({
        ...event,
        party: testParty,
        testDashboardUrl: `/admin/event/${event.id}/test-dashboard?partyId=${testParty.id}`,
      });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
