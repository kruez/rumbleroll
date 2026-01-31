import { NextRequest, NextResponse } from "next/server";

interface PexelsPhoto {
  id: number;
  url: string;
  photographer: string;
  photographer_url: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  alt: string;
}

interface PexelsResponse {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
}

export interface ImageSearchResult {
  id: string;
  url: string;
  thumb: string;
  alt: string;
  photographer: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = parseInt(searchParams.get("per_page") || "15", 10);

  if (!query) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Pexels API key not configured" }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`,
      {
        headers: {
          Authorization: apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Pexels API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to fetch images from Pexels" },
        { status: response.status }
      );
    }

    const data: PexelsResponse = await response.json();

    const results: ImageSearchResult[] = data.photos.map((photo) => ({
      id: String(photo.id),
      url: photo.src.large,
      thumb: photo.src.small,
      alt: photo.alt || `Photo by ${photo.photographer}`,
      photographer: photo.photographer,
    }));

    return NextResponse.json({
      results,
      total: data.total_results,
      page: data.page,
      perPage: data.per_page,
    });
  } catch (error) {
    console.error("Error fetching from Pexels:", error);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}
