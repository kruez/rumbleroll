"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";

interface RumbleEntry {
  id: string;
  entryNumber: number;
  wrestlerName: string | null;
  enteredAt: string | null;
  eliminatedAt: string | null;
  eliminatedBy: string | null;
  isWinner: boolean;
}

interface RumbleEvent {
  id: string;
  name: string;
  year: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  entries: RumbleEntry[];
  _count: { parties: number };
}

export default function EventAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [event, setEvent] = useState<RumbleEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<number | null>(null);
  const [wrestlerInput, setWrestlerInput] = useState("");
  const [eliminatedByInput, setEliminatedByInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user?.isAdmin) {
      router.push("/dashboard");
      return;
    }
    fetchEvent();
  }, [session, status, router, id]);

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/admin/events/${id}`);
      if (res.ok) {
        const data = await res.json();
        setEvent(data);
      } else {
        router.push("/admin");
      }
    } catch (error) {
      console.error("Failed to fetch event:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchEvent();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleSetWrestler = async (entryNumber: number) => {
    if (!wrestlerInput.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/events/${id}/entries`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryNumber, wrestlerName: wrestlerInput }),
      });
      if (res.ok) {
        setEditingEntry(null);
        setWrestlerInput("");
        fetchEvent();
      }
    } catch (error) {
      console.error("Failed to set wrestler:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleEliminate = async (entryNumber: number) => {
    if (!eliminatedByInput.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/events/${id}/entries`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryNumber, eliminatedBy: eliminatedByInput }),
      });
      if (res.ok) {
        setEditingEntry(null);
        setEliminatedByInput("");
        fetchEvent();
      }
    } catch (error) {
      console.error("Failed to eliminate:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeclareWinner = async (entryNumber: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/events/${id}/entries`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryNumber, isWinner: true }),
      });
      if (res.ok) {
        fetchEvent();
      }
    } catch (error) {
      console.error("Failed to declare winner:", error);
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (!session?.user?.isAdmin || !event) {
    return null;
  }

  const enteredCount = event.entries.filter((e) => e.wrestlerName).length;
  const eliminatedCount = event.entries.filter((e) => e.eliminatedAt).length;
  const activeCount = event.entries.filter((e) => e.wrestlerName && !e.eliminatedAt && !e.isWinner).length;
  const winner = event.entries.find((e) => e.isWinner);
  const nextEntry = event.entries.find((e) => !e.wrestlerName);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Header />

      {/* Page Header */}
      <div className="border-b border-gray-700 bg-gray-900/30">
        <div className="container mx-auto px-4 py-4">
          <Link href="/admin" className="text-gray-400 hover:text-white text-sm">
            &larr; Back to Events
          </Link>
          <div className="flex justify-between items-center mt-2">
            <div>
              <h1 className="text-2xl font-bold text-white">{event.name}</h1>
              <p className="text-gray-400">{event._count.parties} parties using this event</p>
            </div>
            <div className="flex items-center gap-4">
              <Select value={event.status} onValueChange={handleUpdateStatus}>
                <SelectTrigger className="w-40 bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-4 text-center">
              <div className="text-3xl font-bold text-white">{enteredCount}/30</div>
              <div className="text-gray-400 text-sm">Entered</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-4 text-center">
              <div className="text-3xl font-bold text-green-400">{activeCount}</div>
              <div className="text-gray-400 text-sm">In Ring</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-4 text-center">
              <div className="text-3xl font-bold text-red-400">{eliminatedCount}</div>
              <div className="text-gray-400 text-sm">Eliminated</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-4 text-center">
              {winner ? (
                <>
                  <div className="text-xl font-bold text-yellow-400">{winner.wrestlerName}</div>
                  <div className="text-gray-400 text-sm">Winner (#{winner.entryNumber})</div>
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold text-gray-500">-</div>
                  <div className="text-gray-400 text-sm">No Winner Yet</div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Entry for Next Wrestler */}
        {nextEntry && !winner && (
          <Card className="bg-purple-900/30 border-purple-500 mb-8">
            <CardHeader>
              <CardTitle className="text-white">Enter Next Wrestler (#{nextEntry.entryNumber})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Input
                  placeholder="Wrestler name..."
                  value={editingEntry === nextEntry.entryNumber ? wrestlerInput : ""}
                  onChange={(e) => {
                    setEditingEntry(nextEntry.entryNumber);
                    setWrestlerInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSetWrestler(nextEntry.entryNumber);
                    }
                  }}
                  className="bg-gray-900 border-gray-600 text-white flex-1"
                />
                <Button
                  onClick={() => handleSetWrestler(nextEntry.entryNumber)}
                  disabled={saving || !wrestlerInput.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {saving ? "Saving..." : "Enter Ring"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Entries */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">All Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {event.entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-4 p-3 rounded-lg ${
                    entry.isWinner
                      ? "bg-yellow-500/20 border border-yellow-500"
                      : entry.eliminatedAt
                      ? "bg-red-500/10 border border-red-500/30"
                      : entry.wrestlerName
                      ? "bg-green-500/10 border border-green-500/30"
                      : "bg-gray-700/30 border border-gray-600"
                  }`}
                >
                  <div className="w-12 text-center">
                    <span className="text-xl font-bold text-white">#{entry.entryNumber}</span>
                  </div>
                  <div className="flex-1">
                    {entry.wrestlerName ? (
                      <div>
                        <span className="text-white font-medium">{entry.wrestlerName}</span>
                        {entry.isWinner && (
                          <Badge className="ml-2 bg-yellow-500 text-black">WINNER</Badge>
                        )}
                        {entry.eliminatedAt && entry.eliminatedBy && (
                          <span className="text-red-400 text-sm ml-2">
                            Eliminated by {entry.eliminatedBy}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500">Not entered yet</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!entry.wrestlerName ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Wrestler name..."
                          value={editingEntry === entry.entryNumber ? wrestlerInput : ""}
                          onChange={(e) => {
                            setEditingEntry(entry.entryNumber);
                            setWrestlerInput(e.target.value);
                          }}
                          className="bg-gray-900 border-gray-600 text-white w-40"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSetWrestler(entry.entryNumber)}
                          disabled={saving || editingEntry !== entry.entryNumber}
                        >
                          Set
                        </Button>
                      </div>
                    ) : !entry.eliminatedAt && !entry.isWinner ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Eliminated by..."
                          value={editingEntry === entry.entryNumber ? eliminatedByInput : ""}
                          onChange={(e) => {
                            setEditingEntry(entry.entryNumber);
                            setEliminatedByInput(e.target.value);
                          }}
                          className="bg-gray-900 border-gray-600 text-white w-40"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleEliminate(entry.entryNumber)}
                          disabled={saving || editingEntry !== entry.entryNumber}
                        >
                          Eliminate
                        </Button>
                        {!winner && activeCount === 1 && (
                          <Button
                            size="sm"
                            className="bg-yellow-500 hover:bg-yellow-600 text-black"
                            onClick={() => handleDeclareWinner(entry.entryNumber)}
                            disabled={saving}
                          >
                            Declare Winner
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
