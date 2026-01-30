import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runWWEScrape, runSmackdownHotelScrape } from "@/lib/scrapers";
import { invalidateWrestlerCache } from "@/lib/wrestlers/cache";

type ScrapeSource = "smackdownhotel" | "wwe";

// POST /api/admin/wrestlers/scrape - Trigger wrestler scrape
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const force = body.force === true;
    const source: ScrapeSource = body.source || "smackdownhotel";

    // Run the appropriate scraper
    const result =
      source === "wwe"
        ? await runWWEScrape(force)
        : await runSmackdownHotelScrape(force);

    // Invalidate cache so new data is picked up
    if (result.success) {
      invalidateWrestlerCache();
    }

    return NextResponse.json({
      success: result.success,
      totalCount: result.totalCount,
      source,
      errorMessage: result.errorMessage,
    });
  } catch (error) {
    console.error("Error running scrape:", error);
    return NextResponse.json({ error: "Scrape failed" }, { status: 500 });
  }
}
