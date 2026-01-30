import { scrapeWWE } from "./wwe-scraper";
import { ScrapeResult } from "./types";
import { prisma } from "@/lib/prisma";

export type { ScrapedWrestler, ScrapeResult } from "./types";

/**
 * Run the WWE scraper and save results to the database
 */
export async function runWWEScrape(force = false): Promise<ScrapeResult> {
  // Check if we should skip (scraped recently)
  if (!force) {
    const metadata = await prisma.scrapeCacheMetadata.findUnique({
      where: { source: "wwe" },
    });

    if (metadata) {
      const hoursSinceLastScrape =
        (Date.now() - metadata.lastScrapedAt.getTime()) / (1000 * 60 * 60);

      // Skip if scraped within the last hour
      if (hoursSinceLastScrape < 1) {
        return {
          success: true,
          wrestlers: [],
          totalCount: metadata.totalCount,
          errorMessage: "Skipped - recently scraped",
        };
      }
    }
  }

  // Run the scraper
  const result = await scrapeWWE();

  if (!result.success || result.wrestlers.length === 0) {
    // Update metadata with failure
    await prisma.scrapeCacheMetadata.upsert({
      where: { source: "wwe" },
      create: {
        source: "wwe",
        lastScrapedAt: new Date(),
        totalCount: 0,
        status: "failed",
        errorMessage: result.errorMessage,
      },
      update: {
        lastScrapedAt: new Date(),
        status: "failed",
        errorMessage: result.errorMessage,
      },
    });
    return result;
  }

  // Upsert wrestlers to database
  let successCount = 0;
  for (const wrestler of result.wrestlers) {
    try {
      await prisma.wrestler.upsert({
        where: { slug: wrestler.slug },
        create: {
          name: wrestler.name,
          slug: wrestler.slug,
          imageUrl: wrestler.imageUrl,
          brand: wrestler.brand,
          source: wrestler.source,
          sourceId: wrestler.sourceId,
          isActive: true,
          aliases: [],
        },
        update: {
          name: wrestler.name,
          imageUrl: wrestler.imageUrl,
          brand: wrestler.brand,
          isActive: true,
          updatedAt: new Date(),
        },
      });
      successCount++;
    } catch (error) {
      console.error(`Failed to upsert wrestler ${wrestler.name}:`, error);
    }
  }

  // Update metadata
  const status = successCount === result.wrestlers.length ? "success" : "partial";
  await prisma.scrapeCacheMetadata.upsert({
    where: { source: "wwe" },
    create: {
      source: "wwe",
      lastScrapedAt: new Date(),
      totalCount: successCount,
      status,
    },
    update: {
      lastScrapedAt: new Date(),
      totalCount: successCount,
      status,
      errorMessage: null,
    },
  });

  return {
    ...result,
    totalCount: successCount,
  };
}
