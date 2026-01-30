"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/Header";

interface ScrapeStats {
  source: string;
  lastScrapedAt: string | null;
  totalCount: number;
  status: string;
  staleness: "fresh" | "moderate" | "stale";
  errorMessage?: string;
}

export default function WrestlerManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<ScrapeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{ success: boolean; totalCount: number; errorMessage?: string } | null>(null);
  const [newWrestlerName, setNewWrestlerName] = useState("");
  const [newWrestlerImage, setNewWrestlerImage] = useState("");
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<{ success: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user?.isAdmin) {
      router.push("/dashboard");
      return;
    }
    fetchStats();
  }, [session, status, router]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/wrestlers/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async (force = false) => {
    setScraping(true);
    setScrapeResult(null);
    try {
      const res = await fetch("/api/admin/wrestlers/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "smackdownhotel", force }),
      });
      const data = await res.json();
      setScrapeResult(data);
      if (data.success) {
        fetchStats();
      }
    } catch (error) {
      console.error("Scrape failed:", error);
      setScrapeResult({ success: false, totalCount: 0, errorMessage: "Request failed" });
    } finally {
      setScraping(false);
    }
  };

  const handleAddWrestler = async () => {
    if (!newWrestlerName.trim()) return;
    setAdding(true);
    setAddResult(null);
    try {
      const res = await fetch("/api/admin/wrestlers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWrestlerName.trim(),
          imageUrl: newWrestlerImage.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddResult({ success: true });
        setNewWrestlerName("");
        setNewWrestlerImage("");
        fetchStats();
      } else {
        setAddResult({ success: false, error: data.error });
      }
    } catch (error) {
      console.error("Failed to add wrestler:", error);
      setAddResult({ success: false, error: "Request failed" });
    } finally {
      setAdding(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStalenessColor = (staleness: string) => {
    switch (staleness) {
      case "fresh":
        return "text-green-400";
      case "moderate":
        return "text-yellow-400";
      case "stale":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getStalenessIndicator = (staleness: string) => {
    switch (staleness) {
      case "fresh":
        return { color: "bg-green-500", label: "Fresh" };
      case "moderate":
        return { color: "bg-yellow-500", label: "Needs Update" };
      case "stale":
        return { color: "bg-red-500", label: "Stale" };
      default:
        return { color: "bg-gray-500", label: "Unknown" };
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (!session?.user?.isAdmin) {
    return null;
  }

  const indicator = stats ? getStalenessIndicator(stats.staleness) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Header />

      <div className="border-b border-gray-700 bg-gray-900/30">
        <div className="container mx-auto px-4 py-4">
          <Link href="/admin" className="text-gray-400 hover:text-white text-sm">
            &larr; Back to Admin
          </Link>
          <h1 className="text-2xl font-bold text-white mt-2">Wrestler Database</h1>
          <p className="text-gray-400">Manage the wrestler database used for autocomplete</p>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Card */}
        <Card className="bg-gray-800/50 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-3">
              WWE Superstars
              {indicator && (
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${indicator.color}/20`}>
                  <span className={`w-2 h-2 rounded-full ${indicator.color}`} />
                  <span className={getStalenessColor(stats?.staleness || "")}>{indicator.label}</span>
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6 mb-6">
              <div>
                <p className="text-gray-400 text-sm">Total Wrestlers</p>
                <p className="text-3xl font-bold text-white">{stats?.totalCount || 0}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Last Updated</p>
                <p className="text-lg text-white">{formatDate(stats?.lastScrapedAt || null)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Status</p>
                <p className="text-lg text-white capitalize">{stats?.status || "Never scraped"}</p>
              </div>
            </div>

            {stats?.errorMessage && (
              <div className="bg-red-900/30 border border-red-500 rounded-lg p-3 mb-6">
                <p className="text-red-400 text-sm">Last error: {stats.errorMessage}</p>
              </div>
            )}

            <div className="flex gap-4">
              <Button
                onClick={() => handleScrape(false)}
                disabled={scraping}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {scraping ? "Scraping..." : "Refresh Data"}
              </Button>
              <Button
                onClick={() => handleScrape(true)}
                disabled={scraping}
                variant="outline"
                className="border-gray-500 text-gray-300 hover:bg-gray-700"
              >
                Force Refresh
              </Button>
            </div>

            {scrapeResult && (
              <div className={`mt-4 p-3 rounded-lg ${scrapeResult.success ? "bg-green-900/30 border border-green-500" : "bg-red-900/30 border border-red-500"}`}>
                {scrapeResult.success ? (
                  <p className="text-green-400">
                    Successfully scraped {scrapeResult.totalCount} wrestlers
                  </p>
                ) : (
                  <p className="text-red-400">
                    Scrape failed: {scrapeResult.errorMessage || "Unknown error"}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Wrestler Card */}
        <Card className="bg-gray-800/50 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Add Wrestler Manually</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 text-sm mb-4">
              Add wrestlers not found in the scraped database (e.g., surprise entrants, legends, new debuts)
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wrestlerName" className="text-white">Wrestler Name *</Label>
                <Input
                  id="wrestlerName"
                  placeholder="e.g., John Cena"
                  value={newWrestlerName}
                  onChange={(e) => setNewWrestlerName(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wrestlerImage" className="text-white">Image URL (optional)</Label>
                <Input
                  id="wrestlerImage"
                  placeholder="https://..."
                  value={newWrestlerImage}
                  onChange={(e) => setNewWrestlerImage(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>
            <div className="mt-4">
              <Button
                onClick={handleAddWrestler}
                disabled={adding || !newWrestlerName.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {adding ? "Adding..." : "Add Wrestler"}
              </Button>
            </div>
            {addResult && (
              <div className={`mt-4 p-3 rounded-lg ${addResult.success ? "bg-green-900/30 border border-green-500" : "bg-red-900/30 border border-red-500"}`}>
                {addResult.success ? (
                  <p className="text-green-400">Wrestler added successfully</p>
                ) : (
                  <p className="text-red-400">{addResult.error || "Failed to add wrestler"}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-400">
            <ul className="space-y-2">
              <li>
                <strong className="text-white">Data Source:</strong> TheSmackdownHotel.com WWE roster
              </li>
              <li>
                <strong className="text-white">Includes:</strong> Current Raw, SmackDown, NXT superstars and legends
              </li>
              <li>
                <strong className="text-white">Images:</strong> Wrestler photos from TheSmackdownHotel
              </li>
              <li>
                <strong className="text-white">Freshness:</strong> Green (0-7 days), Yellow (7-30 days), Red (30+ days)
              </li>
              <li>
                <strong className="text-white">Rate Limiting:</strong> Scrapes are limited to once per hour unless forced
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
