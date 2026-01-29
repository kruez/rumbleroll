import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Test player names for party testing
const TEST_PLAYER_NAMES = [
  "Test Player 1", "Test Player 2", "Test Player 3", "Test Player 4", "Test Player 5",
  "Test Player 6", "Test Player 7", "Test Player 8", "Test Player 9", "Test Player 10",
  "Test Player 11", "Test Player 12", "Test Player 13", "Test Player 14", "Test Player 15",
  "Test Player 16", "Test Player 17", "Test Player 18", "Test Player 19", "Test Player 20",
];

// POST /api/parties/[id]/test
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: partyId } = await params;
    const { action, count = 5 } = await request.json();

    // Verify party exists and user is host
    const party = await prisma.party.findUnique({
      where: { id: partyId },
      include: {
        participants: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    if (party.hostId !== session.user.id) {
      return NextResponse.json({ error: "Only the host can use test mode" }, { status: 403 });
    }

    switch (action) {
      case "addPlayers": {
        // Limit count to reasonable number
        const playerCount = Math.min(Math.max(1, count), 20);

        // Find existing test players to determine next number
        const existingTestUsers = await prisma.user.findMany({
          where: {
            email: { endsWith: "@test.local" },
          },
          select: { id: true, email: true },
        });

        // Find which test player numbers are already in this party
        const testParticipantEmails = new Set(
          party.participants
            .filter(p => p.user.email.endsWith("@test.local"))
            .map(p => p.user.email)
        );

        // Find available test player slots
        const availableNames: string[] = [];
        for (let i = 0; i < TEST_PLAYER_NAMES.length && availableNames.length < playerCount; i++) {
          const email = `testplayer${i + 1}@test.local`;
          if (!testParticipantEmails.has(email)) {
            availableNames.push(TEST_PLAYER_NAMES[i]);
          }
        }

        if (availableNames.length === 0) {
          return NextResponse.json({
            error: "No more test player slots available (max 20)",
          }, { status: 400 });
        }

        const createdCount = Math.min(availableNames.length, playerCount);
        const addedPlayers: string[] = [];

        for (let i = 0; i < createdCount; i++) {
          const name = availableNames[i];
          const playerNum = TEST_PLAYER_NAMES.indexOf(name) + 1;
          const email = `testplayer${playerNum}@test.local`;

          // Find or create the test user
          let testUser = existingTestUsers.find(u => u.email === email);

          if (!testUser) {
            const newUser = await prisma.user.create({
              data: {
                email,
                name,
                // Unusable password hash - test users can't log in
                password: "$2a$10$TESTUSER.NOLOGIN.PLACEHOLDER",
              },
            });
            testUser = { id: newUser.id, email: newUser.email };
          }

          // Add as participant if not already in party
          const existingParticipant = party.participants.find(
            p => p.userId === testUser!.id
          );

          if (!existingParticipant) {
            await prisma.partyParticipant.create({
              data: {
                partyId,
                userId: testUser.id,
              },
            });
            addedPlayers.push(name);
          }
        }

        return NextResponse.json({
          success: true,
          message: `Added ${addedPlayers.length} test players`,
          players: addedPlayers,
        });
      }

      case "removeTestPlayers": {
        // Find all test player participants in this party
        const testParticipants = party.participants.filter(
          p => p.user.email.endsWith("@test.local")
        );

        if (testParticipants.length === 0) {
          return NextResponse.json({
            success: true,
            message: "No test players to remove",
            removed: 0,
          });
        }

        // Delete their assignments first
        await prisma.numberAssignment.deleteMany({
          where: {
            participantId: { in: testParticipants.map(p => p.id) },
          },
        });

        // Delete participants
        await prisma.partyParticipant.deleteMany({
          where: {
            id: { in: testParticipants.map(p => p.id) },
          },
        });

        return NextResponse.json({
          success: true,
          message: `Removed ${testParticipants.length} test players`,
          removed: testParticipants.length,
        });
      }

      case "reset": {
        // Remove test players
        const testParticipants = party.participants.filter(
          p => p.user.email.endsWith("@test.local")
        );

        if (testParticipants.length > 0) {
          await prisma.numberAssignment.deleteMany({
            where: {
              participantId: { in: testParticipants.map(p => p.id) },
            },
          });

          await prisma.partyParticipant.deleteMany({
            where: {
              id: { in: testParticipants.map(p => p.id) },
            },
          });
        }

        // Clear all number assignments for remaining participants
        await prisma.numberAssignment.deleteMany({
          where: { partyId },
        });

        // Reset party status to LOBBY
        await prisma.party.update({
          where: { id: partyId },
          data: { status: "LOBBY" },
        });

        return NextResponse.json({
          success: true,
          message: "Party reset to lobby state",
          testPlayersRemoved: testParticipants.length,
        });
      }

      default:
        return NextResponse.json({
          error: "Invalid action. Use: addPlayers, removeTestPlayers, or reset",
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in party test mode:", error);
    return NextResponse.json({ error: "Test mode operation failed" }, { status: 500 });
  }
}
