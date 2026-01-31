import { NextRequest, NextResponse } from "next/server";

export interface WrestlerImageResult {
  url: string;
  thumb: string;
  source: "thesportsdb" | "serpapi";
  title?: string;
}

interface TheSportsDBPlayer {
  idPlayer: string;
  strPlayer: string;
  strThumb: string | null;
  strCutout: string | null;
  strRender: string | null;
  strFanart1: string | null;
  strFanart2: string | null;
  strFanart3: string | null;
  strFanart4: string | null;
}

interface TheSportsDBResponse {
  player: TheSportsDBPlayer[] | null;
}

interface SerpApiImageResult {
  position: number;
  thumbnail: string;
  original: string;
  title: string;
  source: string;
}

interface SerpApiResponse {
  images_results?: SerpApiImageResult[];
  error?: string;
}

async function searchTheSportsDB(query: string): Promise<WrestlerImageResult[]> {
  try {
    // TheSportsDB free tier - search players
    const response = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      console.error("TheSportsDB API error:", response.status);
      return [];
    }

    const data: TheSportsDBResponse = await response.json();

    if (!data.player) {
      return [];
    }

    // Filter to only WWE-related players and collect their images
    const results: WrestlerImageResult[] = [];

    for (const player of data.player) {
      // Collect all available images for each player
      const images = [
        player.strThumb,
        player.strCutout,
        player.strRender,
        player.strFanart1,
        player.strFanart2,
        player.strFanart3,
        player.strFanart4,
      ].filter((img): img is string => img !== null && img.length > 0);

      for (const imageUrl of images) {
        results.push({
          url: imageUrl,
          thumb: imageUrl.replace("/preview", "/tiny") || imageUrl,
          source: "thesportsdb",
          title: player.strPlayer,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Error fetching from TheSportsDB:", error);
    return [];
  }
}

async function searchSerpApi(query: string): Promise<WrestlerImageResult[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.log("SerpApi key not configured, skipping fallback");
    return [];
  }

  try {
    // Add "WWE" to the query to get more relevant results
    const searchQuery = query.toLowerCase().includes("wwe")
      ? query
      : `${query} WWE wrestler`;

    const response = await fetch(
      `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(searchQuery)}&api_key=${apiKey}&num=10`
    );

    if (!response.ok) {
      console.error("SerpApi error:", response.status);
      return [];
    }

    const data: SerpApiResponse = await response.json();

    if (data.error) {
      console.error("SerpApi error:", data.error);
      return [];
    }

    if (!data.images_results) {
      return [];
    }

    return data.images_results.map((result) => ({
      url: result.original,
      thumb: result.thumbnail,
      source: "serpapi" as const,
      title: result.title,
    }));
  } catch (error) {
    console.error("Error fetching from SerpApi:", error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  // First, try TheSportsDB
  let results = await searchTheSportsDB(query);

  // If no results, fall back to SerpApi
  if (results.length === 0) {
    results = await searchSerpApi(query);
  }

  // If still no results, try SerpApi with just the name (without WWE appended)
  if (results.length === 0 && process.env.SERPAPI_KEY) {
    const response = await fetch(
      `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query + " wrestler")}&api_key=${process.env.SERPAPI_KEY}&num=10`
    );

    if (response.ok) {
      const data: SerpApiResponse = await response.json();
      if (data.images_results) {
        results = data.images_results.map((result) => ({
          url: result.original,
          thumb: result.thumbnail,
          source: "serpapi" as const,
          title: result.title,
        }));
      }
    }
  }

  return NextResponse.json({ results });
}
