/**
 * Domains that require proxying due to hotlink protection
 */
const PROXY_DOMAINS = [
  "thesmackdownhotel.com",
  "www.thesmackdownhotel.com",
];

/**
 * Returns a proxied URL for images that have hotlink protection.
 * For allowed domains (like WWE.com), returns the original URL.
 *
 * @param imageUrl - The original image URL
 * @returns The proxied URL if needed, or the original URL
 */
export function getProxiedImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;

  try {
    const url = new URL(imageUrl);

    // Check if this domain needs proxying
    const needsProxy = PROXY_DOMAINS.some(
      domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    );

    if (needsProxy) {
      return `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    }

    return imageUrl;
  } catch {
    // Invalid URL, return as-is
    return imageUrl;
  }
}
