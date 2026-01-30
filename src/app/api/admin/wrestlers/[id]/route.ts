import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateWrestlerCache } from "@/lib/wrestlers/cache";

// PATCH /api/admin/wrestlers/[id] - Update a wrestler
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
    const body = await request.json();
    const { name, imageUrl, brand, isActive } = body;

    // Find existing wrestler
    const existing = await prisma.wrestler.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Wrestler not found" }, { status: 404 });
    }

    // Build update data
    const updateData: {
      name?: string;
      slug?: string;
      imageUrl?: string | null;
      brand?: string | null;
      isActive?: boolean;
    } = {};

    // Handle name change (requires slug regeneration)
    if (name !== undefined && name !== existing.name) {
      if (typeof name !== "string" || name.trim().length < 2) {
        return NextResponse.json({ error: "Name is required (min 2 characters)" }, { status: 400 });
      }

      const newSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Check if new slug conflicts with another wrestler
      const slugConflict = await prisma.wrestler.findFirst({
        where: {
          slug: newSlug,
          id: { not: id },
        },
      });

      if (slugConflict) {
        return NextResponse.json({ error: "Another wrestler with this name already exists" }, { status: 409 });
      }

      updateData.name = name.trim();
      updateData.slug = newSlug;
    }

    // Handle image URL change
    if (imageUrl !== undefined) {
      updateData.imageUrl = imageUrl?.trim() || null;
    }

    // Handle brand change
    if (brand !== undefined) {
      updateData.brand = brand?.trim() || null;
    }

    // Handle active status change
    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    // If no updates, return current wrestler
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true, wrestler: existing });
    }

    const wrestler = await prisma.wrestler.update({
      where: { id },
      data: updateData,
    });

    invalidateWrestlerCache();

    return NextResponse.json({ success: true, wrestler });
  } catch (error) {
    console.error("Error updating wrestler:", error);
    return NextResponse.json({ error: "Failed to update wrestler" }, { status: 500 });
  }
}

// DELETE /api/admin/wrestlers/[id] - Soft delete (deactivate) a wrestler
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

    // Find existing wrestler
    const existing = await prisma.wrestler.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Wrestler not found" }, { status: 404 });
    }

    // Soft delete by setting isActive to false
    const wrestler = await prisma.wrestler.update({
      where: { id },
      data: { isActive: false },
    });

    invalidateWrestlerCache();

    return NextResponse.json({ success: true, wrestler });
  } catch (error) {
    console.error("Error deactivating wrestler:", error);
    return NextResponse.json({ error: "Failed to deactivate wrestler" }, { status: 500 });
  }
}
