import * as cheerio from "cheerio";
import { ScrapedWrestler, ScrapeResult, ScrapeBrand } from "./types";

const WWE_BASE_URL = "https://www.wwe.com";

// WWE Superstar listing pages by brand/category
const WWE_BRANDS: ScrapeBrand[] = [
  { name: "Raw", url: "/superstars?brand=raw" },
  { name: "SmackDown", url: "/superstars?brand=smackdown" },
  { name: "NXT", url: "/superstars?brand=nxt" },
  { name: "Alumni", url: "/superstars?brand=alumni" },
];

// Rate limiting helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parse wrestler data from WWE superstar page HTML
 */
function parseWrestlerCards($: cheerio.CheerioAPI, brand: string): ScrapedWrestler[] {
  const wrestlers: ScrapedWrestler[] = [];

  // WWE uses different selectors depending on page structure
  // Try multiple possible selectors for wrestler cards
  const cardSelectors = [
    ".superstars-container .superstar-card",
    ".superstars-list .superstar-item",
    "[data-testid='superstar-card']",
    ".wrestler-card",
    "article.superstar",
    ".superstars__list-item",
    "a[href*='/superstars/']",
  ];

  for (const selector of cardSelectors) {
    const cards = $(selector);
    if (cards.length > 0) {
      cards.each((_, el) => {
        const $card = $(el);

        // Try to extract name
        let name =
          $card.find("h2, h3, .superstar-name, .name, [data-testid='superstar-name']").first().text().trim() ||
          $card.attr("title") ||
          $card.find("img").attr("alt") ||
          "";

        if (!name) return;

        // Try to extract slug from href
        let slug = "";
        const href = $card.attr("href") || $card.find("a").first().attr("href") || "";
        const slugMatch = href.match(/\/superstars\/([^/?]+)/);
        if (slugMatch) {
          slug = slugMatch[1];
        } else {
          // Generate slug from name
          slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        }

        // Try to extract image URL
        let imageUrl: string | null = null;
        const imgEl = $card.find("img").first();
        if (imgEl.length > 0) {
          imageUrl =
            imgEl.attr("src") ||
            imgEl.attr("data-src") ||
            imgEl.attr("data-lazy-src") ||
            null;

          // Make sure it's an absolute URL
          if (imageUrl && !imageUrl.startsWith("http")) {
            imageUrl = `${WWE_BASE_URL}${imageUrl}`;
          }
        }

        // Only add if we have a valid name and slug
        if (name && slug) {
          wrestlers.push({
            name,
            slug,
            imageUrl,
            brand,
            source: "wwe",
          });
        }
      });

      // If we found cards with this selector, stop trying others
      if (wrestlers.length > 0) break;
    }
  }

  return wrestlers;
}

/**
 * Fetch and parse a WWE superstars page
 */
async function scrapeBrandPage(brand: ScrapeBrand): Promise<ScrapedWrestler[]> {
  try {
    const url = `${WWE_BASE_URL}${brand.url}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const wrestlers = parseWrestlerCards($, brand.name);

    console.log(`Scraped ${wrestlers.length} wrestlers from ${brand.name}`);
    return wrestlers;
  } catch (error) {
    console.error(`Error scraping ${brand.name}:`, error);
    return [];
  }
}

/**
 * Try alternative approach: scrape the main superstars page which may have all wrestlers
 */
async function scrapeMainPage(): Promise<ScrapedWrestler[]> {
  try {
    const url = `${WWE_BASE_URL}/superstars`;
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch main superstars page: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Look for JSON data embedded in the page (many modern sites do this)
    const wrestlers: ScrapedWrestler[] = [];

    // Try to find script tags with wrestler data
    $("script").each((_, el) => {
      const scriptContent = $(el).html() || "";

      // Look for JSON data patterns (using [\s\S] instead of /s flag for compatibility)
      const jsonPatterns = [
        /__NEXT_DATA__[\s\S]*?(\{[\s\S]*\})/,
        /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/,
        /"superstars"\s*:\s*(\[[\s\S]*?\])/,
      ];

      for (const pattern of jsonPatterns) {
        const match = scriptContent.match(pattern);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            // Navigate through common data structures
            const extractWrestlers = (obj: unknown): void => {
              if (!obj || typeof obj !== "object") return;

              if (Array.isArray(obj)) {
                for (const item of obj) {
                  if (item && typeof item === "object" && "name" in item && "slug" in item) {
                    const w = item as { name: string; slug: string; image?: { url?: string }; brand?: string };
                    wrestlers.push({
                      name: w.name,
                      slug: w.slug,
                      imageUrl: w.image?.url || null,
                      brand: w.brand || null,
                      source: "wwe",
                    });
                  }
                  extractWrestlers(item);
                }
              } else {
                for (const value of Object.values(obj)) {
                  extractWrestlers(value);
                }
              }
            };
            extractWrestlers(data);
          } catch {
            // JSON parse failed, continue
          }
        }
      }
    });

    // Also try HTML parsing
    const htmlWrestlers = parseWrestlerCards($, "WWE");
    wrestlers.push(...htmlWrestlers);

    console.log(`Scraped ${wrestlers.length} wrestlers from main page`);
    return wrestlers;
  } catch (error) {
    console.error("Error scraping main page:", error);
    return [];
  }
}

/**
 * Main scrape function - scrapes all WWE brands
 */
export async function scrapeWWE(): Promise<ScrapeResult> {
  const allWrestlers: ScrapedWrestler[] = [];
  const seenSlugs = new Set<string>();

  try {
    // First try the main page
    const mainPageWrestlers = await scrapeMainPage();
    for (const w of mainPageWrestlers) {
      if (!seenSlugs.has(w.slug)) {
        seenSlugs.add(w.slug);
        allWrestlers.push(w);
      }
    }

    // Then scrape each brand page with rate limiting
    for (const brand of WWE_BRANDS) {
      await delay(2000); // 2 second delay between requests

      const brandWrestlers = await scrapeBrandPage(brand);
      for (const w of brandWrestlers) {
        if (!seenSlugs.has(w.slug)) {
          seenSlugs.add(w.slug);
          allWrestlers.push(w);
        } else {
          // Update brand info if we already have this wrestler but without brand
          const existing = allWrestlers.find((ew) => ew.slug === w.slug);
          if (existing && !existing.brand && w.brand) {
            existing.brand = w.brand;
          }
        }
      }
    }

    return {
      success: allWrestlers.length > 0,
      wrestlers: allWrestlers,
      totalCount: allWrestlers.length,
      errorMessage: allWrestlers.length === 0 ? "No wrestlers found" : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      wrestlers: [],
      totalCount: 0,
      errorMessage: message,
    };
  }
}
