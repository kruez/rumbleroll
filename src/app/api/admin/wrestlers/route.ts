import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateWrestlerCache } from "@/lib/wrestlers/cache";

// POST /api/admin/wrestlers - Manually add a wrestler
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, imageUrl } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Name is required (min 2 characters)" }, { status: 400 });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check if wrestler already exists
    const existing = await prisma.wrestler.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json({ error: "Wrestler with this name already exists" }, { status: 409 });
    }

    const wrestler = await prisma.wrestler.create({
      data: {
        name: name.trim(),
        slug,
        imageUrl: imageUrl?.trim() || null,
        source: "manual",
        isActive: true,
        aliases: [],
      },
    });

    invalidateWrestlerCache();

    return NextResponse.json({ success: true, wrestler });
  } catch (error) {
    console.error("Error adding wrestler:", error);
    return NextResponse.json({ error: "Failed to add wrestler" }, { status: 500 });
  }
}
