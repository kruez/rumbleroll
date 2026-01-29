"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  isTest: boolean;
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
  const [resetting, setResetting] = useState(false);
  const [endEventDialogOpen, setEndEventDialogOpen] = useState(false);
  const [endEventConfirmDialogOpen, setEndEventConfirmDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/events/${id}/entries`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryNumber, eliminatedBy: eliminatedByInput.trim() || null }),
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

  const handleEndEvent = () => {
    const hasWinner = event?.entries.some((e) => e.isWinner);
    if (!hasWinner) {
      setEndEventDialogOpen(true);
    } else {
      handleUpdateStatus("COMPLETED");
    }
  };

  const handleEndEventConfirm = () => {
    setEndEventDialogOpen(false);
    if (event && event._count.parties > 1) {
      setEndEventConfirmDialogOpen(true);
    } else {
      handleUpdateStatus("COMPLETED");
    }
  };

  const handleEndEventFinalConfirm = () => {
    setEndEventConfirmDialogOpen(false);
    handleUpdateStatus("COMPLETED");
  };

  const handleDeleteEvent = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/admin");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete event");
      }
    } catch (error) {
      console.error("Failed to delete event:", error);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleResetEvent = async () => {
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/events/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      if (res.ok) {
        fetchEvent();
      }
    } catch (error) {
      console.error("Failed to reset event:", error);
    } finally {
      setResetting(false);
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
            <div className="flex items-center gap-3">
              {/* Status Action Button */}
              {event.status === "NOT_STARTED" && (
                <Button
                  onClick={() => handleUpdateStatus("IN_PROGRESS")}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Start Event
                </Button>
              )}
              {event.status === "IN_PROGRESS" && (
                <Button
                  onClick={handleEndEvent}
                  className="bg-yellow-600 hover:bg-yellow-700 text-black"
                >
                  End Event
                </Button>
              )}
              {event.status === "COMPLETED" && (
                <Badge className="bg-blue-600 text-white px-4 py-2 text-sm">
                  Completed
                </Badge>
              )}

              {/* Reset Button for completed test events */}
              {event.isTest && event.status === "COMPLETED" && (
                <Button
                  variant="outline"
                  onClick={handleResetEvent}
                  disabled={resetting}
                  className="border-orange-500 text-orange-400 hover:bg-orange-500/20"
                >
                  {resetting ? "Resetting..." : "Reset for Re-simulation"}
                </Button>
              )}

              {/* Delete Button */}
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={!event.isTest && event._count.parties > 0}
                title={
                  !event.isTest && event._count.parties > 0
                    ? "Cannot delete: event has parties using it"
                    : event.isTest && event._count.parties > 0
                    ? "Will also delete associated test parties"
                    : "Delete event"
                }
                className={!event.isTest && event._count.parties > 0 ? "opacity-50 cursor-not-allowed" : ""}
              >
                Delete Event
              </Button>
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
          <Card className={`border-gray-700 ${winner ? "bg-yellow-500/20 border-yellow-500" : "bg-gray-800/50"}`}>
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

        {/* Winner Celebration Banner */}
        {winner && (
          <Card className="bg-gradient-to-r from-yellow-900/50 via-yellow-600/30 to-yellow-900/50 border-yellow-500 mb-8 overflow-hidden">
            <CardContent className="py-8 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/10 to-transparent animate-pulse" />
              <div className="text-center relative z-10">
                {/* Small Championship Belt */}
                <div className="flex justify-center mb-4">
                  <svg viewBox="0 0 200 120" className="w-32 h-20 drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]">
                    <ellipse cx="100" cy="60" rx="85" ry="45" fill="url(#adminBeltGold)" stroke="#B8860B" strokeWidth="3"/>
                    <ellipse cx="100" cy="60" rx="50" ry="25" fill="url(#adminBeltInner)" stroke="#FFD700" strokeWidth="1"/>
                    <circle cx="100" cy="60" r="15" fill="#DC143C" stroke="#FFD700" strokeWidth="2"/>
                    <rect x="10" y="40" width="25" height="40" rx="5" fill="url(#adminBeltGold)" stroke="#B8860B" strokeWidth="2"/>
                    <rect x="165" y="40" width="25" height="40" rx="5" fill="url(#adminBeltGold)" stroke="#B8860B" strokeWidth="2"/>
                    <defs>
                      <linearGradient id="adminBeltGold" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FFD700"/>
                        <stop offset="50%" stopColor="#FFA500"/>
                        <stop offset="100%" stopColor="#FFD700"/>
                      </linearGradient>
                      <linearGradient id="adminBeltInner" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#2D2D2D"/>
                        <stop offset="100%" stopColor="#1A1A1A"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <p className="text-yellow-400 text-sm font-bold tracking-widest mb-2">ROYAL RUMBLE WINNER</p>
                <p className="text-4xl font-black text-white mb-2">{winner.wrestlerName}</p>
                <p className="text-yellow-300 text-lg">Entry #{winner.entryNumber}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Entry for Next Wrestler */}
        {nextEntry && !winner && event.status === "IN_PROGRESS" && (
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

        {/* Message when event not started */}
        {event.status === "NOT_STARTED" && (
          <Card className="bg-blue-900/30 border-blue-500 mb-8">
            <CardContent className="py-6 text-center">
              <p className="text-blue-300 text-lg">Start the event before adding wrestlers</p>
              <p className="text-gray-400 text-sm mt-2">Click the "Start Event" button above to begin</p>
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
                      event.status === "IN_PROGRESS" ? (
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
                      ) : (
                        <span className="text-gray-500 text-sm">Start event to add wrestlers</span>
                      )
                    ) : !entry.eliminatedAt && !entry.isWinner ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Eliminated by... (optional)"
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
                          onClick={() => {
                            setEditingEntry(entry.entryNumber);
                            handleEliminate(entry.entryNumber);
                          }}
                          disabled={saving}
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

      {/* End Event Warning Dialog (no winner) */}
      <Dialog open={endEventDialogOpen} onOpenChange={setEndEventDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">End Event Without Winner?</DialogTitle>
            <DialogDescription className="text-gray-400">
              No winner has been declared. Are you sure you want to end this event?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEndEventDialogOpen(false)}
              className="bg-transparent border-gray-500 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEndEventConfirm}
              className="bg-yellow-600 hover:bg-yellow-700 text-black"
            >
              End Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Event Confirmation Dialog (multiple parties) */}
      <Dialog open={endEventConfirmDialogOpen} onOpenChange={setEndEventConfirmDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm End Event</DialogTitle>
            <DialogDescription className="text-gray-400">
              This event has {event._count.parties} parties watching it. Ending will affect all of them. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEndEventConfirmDialogOpen(false)}
              className="bg-transparent border-gray-500 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEndEventFinalConfirm}
              className="bg-yellow-600 hover:bg-yellow-700 text-black"
            >
              Yes, End Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Event Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Event?</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete &quot;{event.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="bg-transparent border-gray-500 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteEvent}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
