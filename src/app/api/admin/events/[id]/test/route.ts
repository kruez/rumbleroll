import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// List of wrestler names for test mode
const WRESTLER_NAMES = [
  "John Cena", "The Rock", "Stone Cold Steve Austin", "Hulk Hogan", "The Undertaker",
  "Triple H", "Shawn Michaels", "Bret Hart", "Randy Savage", "Ric Flair",
  "Andre the Giant", "Ultimate Warrior", "Randy Orton", "Edge", "Chris Jericho",
  "Batista", "Rey Mysterio", "Kurt Angle", "Eddie Guerrero", "Mick Foley",
  "CM Punk", "Daniel Bryan", "AJ Styles", "Seth Rollins", "Roman Reigns",
  "Dean Ambrose", "Brock Lesnar", "Goldberg", "Kevin Owens", "Finn Balor",
  "Big Show", "Kane", "Booker T", "Rob Van Dam", "Jeff Hardy",
  "Matt Hardy", "Kofi Kingston", "The Miz", "Sheamus", "Alberto Del Rio",
  "Dolph Ziggler", "Cesaro", "Rusev", "Drew McIntyre", "Bobby Lashley",
  "Braun Strowman", "Samoa Joe", "Nakamura", "Cody Rhodes", "Gunther"
];

// POST /api/admin/events/[id]/test
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;
    const { action } = await request.json();

    // Verify event exists
    const event = await prisma.rumbleEvent.findUnique({
      where: { id: eventId },
      include: { entries: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    switch (action) {
      case "enter": {
        // Enter the next wrestler by entry number order
        const nextEmptyEntry = event.entries
          .sort((a, b) => a.entryNumber - b.entryNumber)
          .find((e) => !e.wrestlerName);

        if (!nextEmptyEntry) {
          return NextResponse.json({
            error: "All wrestlers have already entered",
            complete: true,
          }, { status: 400 });
        }

        // Pick a random wrestler name
        const wrestlerName = WRESTLER_NAMES[Math.floor(Math.random() * WRESTLER_NAMES.length)];

        // Set event to IN_PROGRESS if it was NOT_STARTED
        if (event.status === "NOT_STARTED") {
          await prisma.rumbleEvent.update({
            where: { id: eventId },
            data: { status: "IN_PROGRESS" },
          });
        }

        const updatedEntry = await prisma.rumbleEntry.update({
          where: { id: nextEmptyEntry.id },
          data: {
            wrestlerName,
            enteredAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          entryNumber: updatedEntry.entryNumber,
          wrestlerName: updatedEntry.wrestlerName,
          message: `${wrestlerName} entered at #${updatedEntry.entryNumber}`,
        });
      }

      case "fill": {
        // Auto-fill all empty entries with random wrestler names
        const emptyEntries = event.entries.filter((e) => !e.wrestlerName);
        const shuffledNames = [...WRESTLER_NAMES].sort(() => Math.random() - 0.5);

        for (let i = 0; i < emptyEntries.length; i++) {
          await prisma.rumbleEntry.update({
            where: { id: emptyEntries[i].id },
            data: {
              wrestlerName: shuffledNames[i % shuffledNames.length],
              enteredAt: new Date(),
            },
          });
        }

        // Set event to IN_PROGRESS if it was NOT_STARTED
        if (event.status === "NOT_STARTED") {
          await prisma.rumbleEvent.update({
            where: { id: eventId },
            data: { status: "IN_PROGRESS" },
          });
        }

        return NextResponse.json({
          success: true,
          message: `Filled ${emptyEntries.length} entries with wrestlers`,
        });
      }

      case "eliminate": {
        // Randomly eliminate one active wrestler
        const activeEntries = event.entries.filter(
          (e) => e.wrestlerName && !e.eliminatedAt && !e.isWinner
        );

        if (activeEntries.length === 0) {
          return NextResponse.json({
            error: "No active wrestlers to eliminate",
          }, { status: 400 });
        }

        if (activeEntries.length === 1) {
          // Last one standing - declare winner
          const winner = activeEntries[0];
          await prisma.rumbleEntry.update({
            where: { id: winner.id },
            data: { isWinner: true },
          });
          await prisma.rumbleEvent.update({
            where: { id: eventId },
            data: { status: "COMPLETED" },
          });
          return NextResponse.json({
            success: true,
            message: `${winner.wrestlerName} wins!`,
            winner: winner.wrestlerName,
          });
        }

        // Pick random wrestler to eliminate
        const toEliminate = activeEntries[Math.floor(Math.random() * activeEntries.length)];
        // Pick random remaining wrestler as the eliminator
        const remainingActive = activeEntries.filter((e) => e.id !== toEliminate.id);
        const eliminator = remainingActive[Math.floor(Math.random() * remainingActive.length)];

        await prisma.rumbleEntry.update({
          where: { id: toEliminate.id },
          data: {
            eliminatedAt: new Date(),
            eliminatedBy: eliminator.wrestlerName,
          },
        });

        return NextResponse.json({
          success: true,
          message: `${toEliminate.wrestlerName} eliminated by ${eliminator.wrestlerName}`,
          eliminated: toEliminate.wrestlerName,
          eliminatedBy: eliminator.wrestlerName,
          remaining: activeEntries.length - 1,
        });
      }

      case "reset": {
        // Clear all wrestler data and reset event
        await prisma.rumbleEntry.updateMany({
          where: { eventId },
          data: {
            wrestlerName: null,
            enteredAt: null,
            eliminatedAt: null,
            eliminatedBy: null,
            isWinner: false,
          },
        });

        await prisma.rumbleEvent.update({
          where: { id: eventId },
          data: { status: "NOT_STARTED" },
        });

        return NextResponse.json({
          success: true,
          message: "Event reset successfully",
        });
      }

      default:
        return NextResponse.json({
          error: "Invalid action. Use: enter, fill, eliminate, or reset",
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in test mode:", error);
    return NextResponse.json({ error: "Test mode operation failed" }, { status: 500 });
  }
}
