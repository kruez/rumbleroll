export interface ScrapedWrestler {
  name: string;
  slug: string;
  imageUrl: string | null;
  brand: string | null;
  source: "wwe" | "smackdownhotel";
  sourceId?: string;
}

export interface ScrapeResult {
  success: boolean;
  wrestlers: ScrapedWrestler[];
  totalCount: number;
  errorMessage?: string;
}

export interface ScrapeBrand {
  name: string;
  url: string;
}
