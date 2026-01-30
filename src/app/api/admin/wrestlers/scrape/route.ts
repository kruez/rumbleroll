import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runWWEScrape } from "@/lib/scrapers";
import { invalidateWrestlerCache } from "@/lib/wrestlers/cache";

// POST /api/admin/wrestlers/scrape - Trigger WWE scrape
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const force = body.force === true;

    // Run the scrape
    const result = await runWWEScrape(force);

    // Invalidate cache so new data is picked up
    if (result.success) {
      invalidateWrestlerCache();
    }

    return NextResponse.json({
      success: result.success,
      totalCount: result.totalCount,
      errorMessage: result.errorMessage,
    });
  } catch (error) {
    console.error("Error running scrape:", error);
    return NextResponse.json({ error: "Scrape failed" }, { status: 500 });
  }
}
