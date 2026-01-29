import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/events/[id] - Get event details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const event = await prisma.rumbleEvent.findUnique({
      where: { id },
      include: {
        entries: { orderBy: { entryNumber: "asc" } },
        _count: { select: { parties: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}

// PATCH /api/admin/events/[id] - Update event status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { status } = await request.json();

    const event = await prisma.rumbleEvent.update({
      where: { id },
      data: { status },
      include: {
        entries: { orderBy: { entryNumber: "asc" } },
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

// DELETE /api/admin/events/[id] - Delete event
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if any parties are using this event
    const partiesCount = await prisma.party.count({
      where: { eventId: id },
    });

    if (partiesCount > 0) {
      // Get the event to check if it's a test event
      const event = await prisma.rumbleEvent.findUnique({
        where: { id },
        select: { isTest: true },
      });

      if (event?.isTest) {
        // For test events, cascade delete all associated parties
        await prisma.party.deleteMany({ where: { eventId: id } });
      } else {
        return NextResponse.json(
          { error: "Cannot delete event with active parties" },
          { status: 400 }
        );
      }
    }

    await prisma.rumbleEvent.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
