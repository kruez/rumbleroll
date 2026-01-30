import { NextResponse } from "next/server";
import { searchWrestlers } from "@/lib/wrestlers/cache";

// GET /api/wrestlers/search?q=rock&limit=10
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);

    if (!query.trim()) {
      return NextResponse.json([]);
    }

    const wrestlers = await searchWrestlers(query, limit);

    // Map to API response format
    const results = wrestlers.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      imageUrl: w.imageUrl,
      brand: w.brand,
    }));

    return NextResponse.json(results, {
      headers: {
        // Cache for 5 minutes on CDN, 1 minute in browser
        "Cache-Control": "public, s-maxage=300, max-age=60",
      },
    });
  } catch (error) {
    console.error("Error searching wrestlers:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
