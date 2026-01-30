import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/wrestlers/stats - Get scrape metadata
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const metadata = await prisma.scrapeCacheMetadata.findUnique({
      where: { source: "smackdownhotel" },
    });

    // Get actual wrestler count from database
    const wrestlerCount = await prisma.wrestler.count();

    if (!metadata) {
      return NextResponse.json({
        source: "smackdownhotel",
        lastScrapedAt: null,
        totalCount: wrestlerCount,
        status: "never",
        staleness: "stale",
      });
    }

    // Calculate staleness
    const hoursSinceLastScrape =
      (Date.now() - metadata.lastScrapedAt.getTime()) / (1000 * 60 * 60);
    const daysSinceLastScrape = hoursSinceLastScrape / 24;

    let staleness: "fresh" | "moderate" | "stale";
    if (daysSinceLastScrape <= 7) {
      staleness = "fresh";
    } else if (daysSinceLastScrape <= 30) {
      staleness = "moderate";
    } else {
      staleness = "stale";
    }

    return NextResponse.json({
      source: metadata.source,
      lastScrapedAt: metadata.lastScrapedAt.toISOString(),
      totalCount: wrestlerCount,
      status: metadata.status,
      staleness,
      errorMessage: metadata.errorMessage,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
