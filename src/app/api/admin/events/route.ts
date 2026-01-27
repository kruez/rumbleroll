import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    const { name, year } = await request.json();

    if (!name || !year) {
      return NextResponse.json({ error: "Name and year are required" }, { status: 400 });
    }

    // Create event with 30 blank entries
    const event = await prisma.rumbleEvent.create({
      data: {
        name,
        year,
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

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
