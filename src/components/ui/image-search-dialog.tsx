"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ImageResult {
  id?: string;
  url: string;
  thumb: string;
  alt?: string;
  title?: string;
  photographer?: string;
  source?: string;
}

interface ImageSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (imageUrl: string) => void;
  source: "pexels" | "wrestlers";
  initialQuery?: string;
  title?: string;
  description?: string;
}

export function ImageSearchDialog({
  open,
  onOpenChange,
  onSelect,
  source,
  initialQuery = "",
  title,
  description,
}: ImageSearchDialogProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<ImageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const endpoint =
        source === "pexels"
          ? `/api/images/search?q=${encodeURIComponent(query)}`
          : `/api/images/wrestlers?q=${encodeURIComponent(query)}`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch images");
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      console.error("Image search error:", err);
      setError(err instanceof Error ? err.message : "Failed to search images");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, source]);

  const handleSelect = (imageUrl: string) => {
    onSelect(imageUrl);
    onOpenChange(false);
    // Reset state for next open
    setQuery("");
    setResults([]);
    setSearched(false);
    setError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      // Reset state when closing
      setQuery(initialQuery);
      setResults([]);
      setSearched(false);
      setError(null);
    } else if (initialQuery) {
      // Auto-search if we have an initial query
      setQuery(initialQuery);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const defaultTitle =
    source === "pexels" ? "Search Profile Images" : "Search Wrestler Images";
  const defaultDescription =
    source === "pexels"
      ? "Search for profile pictures from Pexels"
      : "Search for wrestler images from TheSportsDB";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white">{title || defaultTitle}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {description || defaultDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              source === "pexels"
                ? "Search for images (e.g., portrait, avatar)..."
                : "Search for wrestler (e.g., Cody Rhodes)..."
            }
            className="bg-gray-700 border-gray-600 text-white"
            autoFocus
          />
          <Button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-900/30 border border-red-500">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400">Searching...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 p-1">
              {results.map((result, index) => (
                <button
                  key={result.id || `${result.url}-${index}`}
                  onClick={() => handleSelect(result.url)}
                  className="relative aspect-square rounded-lg overflow-hidden bg-gray-700 hover:ring-2 hover:ring-purple-500 hover:ring-offset-2 hover:ring-offset-gray-800 transition-all group"
                >
                  <img
                    src={result.thumb}
                    alt={result.alt || result.title || "Image result"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <p className="text-white text-xs truncate w-full">
                      {result.title || result.photographer || result.source}
                    </p>
                  </div>
                  {result.source && (
                    <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-900/80 text-gray-300">
                      {result.source === "thesportsdb"
                        ? "SportsDB"
                        : result.source === "serpapi"
                        ? "Google"
                        : result.source}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : searched && !loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400">No images found. Try a different search.</p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">
                Enter a search term and click Search
              </p>
            </div>
          )}
        </div>

        {source === "pexels" && results.length > 0 && (
          <p className="text-gray-500 text-xs text-center">
            Photos provided by{" "}
            <a
              href="https://www.pexels.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              Pexels
            </a>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
