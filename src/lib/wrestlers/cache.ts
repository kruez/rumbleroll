import { prisma } from "@/lib/prisma";

export interface CachedWrestler {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  brand: string | null;
  aliases: string[];
  nameLower: string;
}

// In-memory cache
let wrestlerCache: CachedWrestler[] = [];
let cacheLoadedAt: number | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load wrestlers from database into memory cache
 */
export async function loadWrestlerCache(): Promise<void> {
  const wrestlers = await prisma.wrestler.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      brand: true,
      aliases: true,
    },
    orderBy: { name: "asc" },
  });

  wrestlerCache = wrestlers.map((w) => ({
    ...w,
    nameLower: w.name.toLowerCase(),
  }));
  cacheLoadedAt = Date.now();

  console.log(`Loaded ${wrestlerCache.length} wrestlers into cache`);
}

/**
 * Get wrestlers from cache, loading if necessary
 */
export async function getWrestlerCache(): Promise<CachedWrestler[]> {
  const now = Date.now();
  const isExpired = !cacheLoadedAt || now - cacheLoadedAt > CACHE_TTL_MS;

  if (wrestlerCache.length === 0 || isExpired) {
    await loadWrestlerCache();
  }

  return wrestlerCache;
}

/**
 * Invalidate the wrestler cache (call after scraping)
 */
export function invalidateWrestlerCache(): void {
  cacheLoadedAt = null;
}

/**
 * Search wrestlers with fuzzy matching
 * Priority: prefix match > word boundary match > contains > alias match
 */
export async function searchWrestlers(
  query: string,
  limit = 10
): Promise<CachedWrestler[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const cache = await getWrestlerCache();
  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/);

  interface ScoredWrestler {
    wrestler: CachedWrestler;
    score: number;
  }

  const scored: ScoredWrestler[] = [];

  for (const wrestler of cache) {
    let score = 0;
    const name = wrestler.nameLower;

    // Exact match (highest priority)
    if (name === queryLower) {
      score = 100;
    }
    // Starts with query
    else if (name.startsWith(queryLower)) {
      score = 80;
    }
    // Word boundary match (e.g., "rock" matches "The Rock")
    else if (
      name.split(/\s+/).some((word) => word.startsWith(queryLower)) ||
      queryWords.every((qw) => name.split(/\s+/).some((w) => w.startsWith(qw)))
    ) {
      score = 60;
    }
    // Contains query
    else if (name.includes(queryLower)) {
      score = 40;
    }
    // Alias match
    else {
      for (const alias of wrestler.aliases) {
        const aliasLower = alias.toLowerCase();
        if (aliasLower === queryLower) {
          score = 50;
          break;
        } else if (aliasLower.startsWith(queryLower)) {
          score = 35;
          break;
        } else if (aliasLower.includes(queryLower)) {
          score = 20;
          break;
        }
      }
    }

    if (score > 0) {
      scored.push({ wrestler, score });
    }
  }

  // Sort by score (descending), then alphabetically
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.wrestler.name.localeCompare(b.wrestler.name);
  });

  return scored.slice(0, limit).map((s) => s.wrestler);
}
