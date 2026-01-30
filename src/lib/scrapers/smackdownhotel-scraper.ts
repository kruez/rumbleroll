import * as cheerio from "cheerio";
import { ScrapedWrestler, ScrapeResult } from "./types";

const SMACKDOWN_HOTEL_URL = "https://www.thesmackdownhotel.com/roster/wwe/";

/**
 * Parse wrestler data from TheSmackdownHotel roster page
 * HTML structure:
 * <a href="/wrestlers/cm-punk" title="CM Punk">
 *   <div class="roster promotion-wwe brand-raw">
 *     <img src="/images/wrestling/wrestlers/c/cm-punk-2024.png"
 *          alt="CM Punk" title="CM Punk" width="200" height="200">
 *     <div class="roster_name">CM Punk</div>
 *   </div>
 * </a>
 */
function parseWrestlerCards($: cheerio.CheerioAPI): ScrapedWrestler[] {
  const wrestlers: ScrapedWrestler[] = [];
  const seenSlugs = new Set<string>();

  // Select all wrestler links with roster cards inside
  $('a[href^="/wrestlers/"]').each((_, el) => {
    const $link = $(el);
    const $roster = $link.find("div.roster");

    // Must have a roster card inside
    if ($roster.length === 0) return;

    const href = $link.attr("href") || "";

    // Extract slug from href /wrestlers/{slug}
    const slugMatch = href.match(/\/wrestlers\/([a-z0-9-]+)(?:\/|$|\?)?/i);
    if (!slugMatch) return;

    const slug = slugMatch[1].toLowerCase();

    // Skip if we've already seen this wrestler
    if (seenSlugs.has(slug)) return;

    // Extract name from .roster_name or title attribute
    const name =
      $roster.find(".roster_name").text().trim() ||
      $link.attr("title")?.trim() ||
      "";

    if (!name || name.length < 2) return;

    // Extract image URL
    let imageUrl: string | null = null;
    const imgEl = $roster.find("img").first();
    if (imgEl.length > 0) {
      const src = imgEl.attr("src") || imgEl.attr("data-src") || null;
      if (src) {
        // Make absolute URL
        imageUrl = src.startsWith("http")
          ? src
          : `https://www.thesmackdownhotel.com${src}`;
      }
    }

    // Extract brand from roster div classes (brand-raw, brand-smackdown, brand-nxt)
    const classList = $roster.attr("class") || "";
    let brand: string | null = null;

    if (classList.includes("brand-raw")) {
      brand = "Raw";
    } else if (classList.includes("brand-smackdown")) {
      brand = "SmackDown";
    } else if (classList.includes("brand-nxt")) {
      brand = "NXT";
    } else if (classList.includes("brand-legends")) {
      brand = "Legends";
    }

    seenSlugs.add(slug);
    wrestlers.push({
      name,
      slug,
      imageUrl,
      brand,
      source: "smackdownhotel",
    });
  });

  return wrestlers;
}

/**
 * Scrape the WWE roster from TheSmackdownHotel
 * This site has all wrestlers on a single page with no JS pagination
 */
export async function scrapeSmackdownHotel(): Promise<ScrapeResult> {
  try {
    console.log(`Fetching roster from ${SMACKDOWN_HOTEL_URL}`);

    const response = await fetch(SMACKDOWN_HOTEL_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        wrestlers: [],
        totalCount: 0,
        errorMessage: `Failed to fetch: ${response.status} ${response.statusText}`,
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const wrestlers = parseWrestlerCards($);

    console.log(`Scraped ${wrestlers.length} wrestlers from TheSmackdownHotel`);

    return {
      success: wrestlers.length > 0,
      wrestlers,
      totalCount: wrestlers.length,
      errorMessage: wrestlers.length === 0 ? "No wrestlers found" : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error scraping TheSmackdownHotel:", error);
    return {
      success: false,
      wrestlers: [],
      totalCount: 0,
      errorMessage: message,
    };
  }
}
