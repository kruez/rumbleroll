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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageSearchDialog } from "@/components/ui/image-search-dialog";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; imageUrl: string | null; brand: string | null; source: string }>>([]);
  const [searching, setSearching] = useState(false);

  // Edit wrestler state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingWrestler, setEditingWrestler] = useState<{ id: string; name: string; imageUrl: string | null; brand: string | null } | null>(null);
  const [editName, setEditName] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [saving, setSaving] = useState(false);
  const [editResult, setEditResult] = useState<{ success: boolean; error?: string } | null>(null);

  // Deactivate wrestler state
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deactivatingWrestler, setDeactivatingWrestler] = useState<{ id: string; name: string } | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Image search state
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const [imageSearchTarget, setImageSearchTarget] = useState<"add" | "edit">("add");
  const [imageSearchQuery, setImageSearchQuery] = useState("");

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

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/wrestlers/search?q=${encodeURIComponent(query)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setSearching(false);
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

  const handleOpenEditDialog = (wrestler: { id: string; name: string; imageUrl: string | null; brand: string | null }) => {
    setEditingWrestler(wrestler);
    setEditName(wrestler.name);
    setEditImageUrl(wrestler.imageUrl || "");
    setEditBrand(wrestler.brand || "");
    setEditResult(null);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingWrestler || !editName.trim()) return;
    setSaving(true);
    setEditResult(null);
    try {
      const res = await fetch(`/api/admin/wrestlers/${editingWrestler.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          imageUrl: editImageUrl.trim() || null,
          brand: editBrand && editBrand !== "none" ? editBrand : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEditResult({ success: true });
        setEditDialogOpen(false);
        // Refresh search results
        if (searchQuery.length >= 2) {
          handleSearch(searchQuery);
        }
        fetchStats();
      } else {
        setEditResult({ success: false, error: data.error });
      }
    } catch (error) {
      console.error("Failed to update wrestler:", error);
      setEditResult({ success: false, error: "Request failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDeactivateDialog = (wrestler: { id: string; name: string }) => {
    setDeactivatingWrestler(wrestler);
    setDeactivateDialogOpen(true);
  };

  const handleDeactivate = async () => {
    if (!deactivatingWrestler) return;
    setDeactivating(true);
    try {
      const res = await fetch(`/api/admin/wrestlers/${deactivatingWrestler.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeactivateDialogOpen(false);
        // Refresh search results
        if (searchQuery.length >= 2) {
          handleSearch(searchQuery);
        }
        fetchStats();
      }
    } catch (error) {
      console.error("Failed to deactivate wrestler:", error);
    } finally {
      setDeactivating(false);
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
                variant="secondary"
                className="bg-gray-600 text-white hover:bg-gray-500"
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

        {/* Search Wrestlers Card */}
        <Card className="bg-gray-800/50 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Search Wrestlers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="searchWrestler" className="text-white">Search by name</Label>
              <Input
                id="searchWrestler"
                placeholder="Type to search..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            {searching && <p className="text-gray-400 text-sm mt-2">Searching...</p>}
            {searchResults.length > 0 && (
              <div className="mt-4 max-h-64 overflow-y-auto">
                <div className="space-y-2">
                  {searchResults.map((w) => (
                    <div key={w.id} className="flex items-center gap-3 p-2 rounded bg-gray-700/50">
                      {w.imageUrl ? (
                        <img src={w.imageUrl} alt={w.name} className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-600 flex items-center justify-center text-gray-400 text-xs">?</div>
                      )}
                      <div className="flex-1">
                        <p className="text-white font-medium">{w.name}</p>
                        <p className="text-gray-400 text-xs">
                          {w.brand && <span className="mr-2">{w.brand}</span>}
                          <span className="text-gray-500">({w.source})</span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleOpenEditDialog(w)}
                          className="bg-gray-600 text-white hover:bg-gray-500"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleOpenDeactivateDialog(w)}
                          className="bg-red-600/50 hover:bg-red-600"
                        >
                          Deactivate
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-gray-400 text-sm mt-4">No wrestlers found matching &quot;{searchQuery}&quot;</p>
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
                <div className="flex gap-2">
                  <Input
                    id="wrestlerImage"
                    placeholder="https://..."
                    value={newWrestlerImage}
                    onChange={(e) => setNewWrestlerImage(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setImageSearchTarget("add");
                      setImageSearchQuery(newWrestlerName);
                      setImageSearchOpen(true);
                    }}
                    disabled={!newWrestlerName.trim()}
                    className="bg-gray-600 text-white hover:bg-gray-500"
                  >
                    Search
                  </Button>
                </div>
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

      {/* Edit Wrestler Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Wrestler</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update wrestler information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editName" className="text-white">Name *</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editImageUrl" className="text-white">Image URL</Label>
              <div className="flex gap-2">
                <Input
                  id="editImageUrl"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-gray-700 border-gray-600 text-white flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setImageSearchTarget("edit");
                    setImageSearchQuery(editName);
                    setImageSearchOpen(true);
                  }}
                  disabled={!editName.trim()}
                  className="bg-gray-600 text-white hover:bg-gray-500"
                >
                  Search
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editBrand" className="text-white">Brand</Label>
              <Select value={editBrand} onValueChange={setEditBrand}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="none" className="text-gray-400">No brand</SelectItem>
                  <SelectItem value="Raw" className="text-red-400">Raw</SelectItem>
                  <SelectItem value="SmackDown" className="text-blue-400">SmackDown</SelectItem>
                  <SelectItem value="NXT" className="text-yellow-400">NXT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editResult && !editResult.success && (
              <div className="p-3 rounded-lg bg-red-900/30 border border-red-500">
                <p className="text-red-400 text-sm">{editResult.error}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="bg-transparent border-gray-500 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={saving || !editName.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Wrestler Confirmation Dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Deactivate Wrestler?</DialogTitle>
            <DialogDescription className="text-gray-400">
              This will remove &quot;{deactivatingWrestler?.name}&quot; from the autocomplete suggestions.
              The wrestler can be reactivated later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeactivateDialogOpen(false)}
              className="bg-transparent border-gray-500 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivating}
            >
              {deactivating ? "Deactivating..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Search Dialog */}
      <ImageSearchDialog
        open={imageSearchOpen}
        onOpenChange={setImageSearchOpen}
        onSelect={(url) => {
          if (imageSearchTarget === "add") {
            setNewWrestlerImage(url);
          } else {
            setEditImageUrl(url);
          }
        }}
        source="wrestlers"
        initialQuery={imageSearchQuery}
      />
    </div>
  );
}
