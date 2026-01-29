import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/user - Get current user's profile
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        venmoHandle: true,
        cashAppHandle: true,
        profileImageUrl: true,
        bio: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

// PATCH /api/user - Update current user's profile
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, venmoHandle, cashAppHandle, profileImageUrl, bio } = body;

    // Validate venmoHandle format
    if (venmoHandle !== undefined && venmoHandle !== null && venmoHandle !== "") {
      if (!venmoHandle.startsWith("@")) {
        return NextResponse.json(
          { error: "Venmo handle must start with @" },
          { status: 400 }
        );
      }
    }

    // Validate cashAppHandle format
    if (cashAppHandle !== undefined && cashAppHandle !== null && cashAppHandle !== "") {
      if (!cashAppHandle.startsWith("$")) {
        return NextResponse.json(
          { error: "CashApp handle must start with $" },
          { status: 400 }
        );
      }
    }

    // Validate bio length
    if (bio !== undefined && bio !== null && bio.length > 200) {
      return NextResponse.json(
        { error: "Bio must be 200 characters or less" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name: name || null }),
        ...(venmoHandle !== undefined && { venmoHandle: venmoHandle || null }),
        ...(cashAppHandle !== undefined && { cashAppHandle: cashAppHandle || null }),
        ...(profileImageUrl !== undefined && { profileImageUrl: profileImageUrl || null }),
        ...(bio !== undefined && { bio: bio || null }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        venmoHandle: true,
        cashAppHandle: true,
        profileImageUrl: true,
        bio: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
