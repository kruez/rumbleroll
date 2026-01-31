import { NextRequest, NextResponse } from "next/server";

/**
 * Image proxy to bypass hotlink protection on external sites.
 * Fetches images server-side without sending a referer header.
 *
 * Usage: /api/image-proxy?url=https://example.com/image.png
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Only allow HTTPS URLs
  if (parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "Only HTTPS URLs are allowed" }, { status: 400 });
  }

  // Allowlist of domains we'll proxy images from
  const allowedDomains = [
    "www.thesmackdownhotel.com",
    "thesmackdownhotel.com",
    "www.wwe.com",
    "wwe.com",
  ];

  if (!allowedDomains.some(domain => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`))) {
    return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/*,*/*;q=0.8",
        // No Referer header - this is the key to bypassing hotlink protection
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400", // Cache for 1 day
        "X-Proxied-From": parsedUrl.hostname,
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 500 }
    );
  }
}
