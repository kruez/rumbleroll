"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { UserAvatar } from "@/components/UserAvatar";
import { ScoreboardDropdown } from "@/components/ScoreboardDropdown";

interface Entry {
  id: string;
  entryNumber: number;
  wrestlerName: string | null;
  enteredAt: string | null;
  eliminatedAt: string | null;
  eliminatedBy: string | null;
  isWinner: boolean;
}

interface Assignment {
  id: string;
  entryNumber: number;
}

interface Participant {
  id: string;
  hasPaid: boolean;
  paidAt: string | null;
  user: { id: string; name: string | null; email: string; profileImageUrl?: string | null };
  assignments: Assignment[];
}

interface RumbleEvent {
  id: string;
  name: string;
  year: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  entries: Entry[];
}

interface Party {
  id: string;
  name: string;
  inviteCode: string;
  status: "LOBBY" | "NUMBERS_ASSIGNED" | "COMPLETED";
  entryFee: number | null;
  hostId: string;
  event: RumbleEvent;
  participants: Participant[];
  isHost: boolean;
}

export default function PartyAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingParticipant, setRemovingParticipant] = useState<string | null>(null);
  const [testModeExpanded, setTestModeExpanded] = useState(false);
  const [testModeLoading, setTestModeLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState<string | null>(null);

  const fetchParty = useCallback(async () => {
    try {
      const res = await fetch(`/api/parties/${id}`);
      if (!res.ok) {
        router.push("/dashboard");
        return;
      }
      const data = await res.json();
      if (!data.isHost) {
        router.push(`/party/${id}`);
        return;
      }
      setParty(data);
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchParty();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchParty, 5000);
    return () => clearInterval(interval);
  }, [fetchParty]);

  const handleRemoveParticipant = async (participantId: string) => {
    setRemovingParticipant(participantId);
    try {
      const res = await fetch(`/api/parties/${id}/participants/${participantId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to remove participant");
        return;
      }
      toast.success("Participant removed");
      fetchParty();
    } catch {
      toast.error("Failed to remove participant");
    } finally {
      setRemovingParticipant(null);
    }
  };

  const handleTogglePayment = async (participantId: string, currentStatus: boolean) => {
    setUpdatingPayment(participantId);
    try {
      const res = await fetch(`/api/parties/${id}/participants/${participantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasPaid: !currentStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update payment status");
        return;
      }
      toast.success(currentStatus ? "Marked as unpaid" : "Marked as paid");
      fetchParty();
    } catch {
      toast.error("Failed to update payment status");
    } finally {
      setUpdatingPayment(null);
    }
  };

  const handleTestModeAction = async (action: string, count?: number) => {
    setTestModeLoading(true);
    try {
      const res = await fetch(`/api/parties/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, count }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Test mode action failed");
        return;
      }
      toast.success(data.message);
      fetchParty();
    } catch {
      toast.error("Test mode action failed");
    } finally {
      setTestModeLoading(false);
    }
  };

  const handleDeleteParty = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/parties/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete party");
        return;
      }
      toast.success("Party deleted");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to delete party");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (!party) return null;

  const entries = party.event.entries;
  const activeWrestlers = entries.filter(e => e.wrestlerName && !e.eliminatedAt && !e.isWinner);
  const eliminatedWrestlers = entries.filter(e => e.eliminatedAt);
  const pendingEntries = entries.filter(e => !e.wrestlerName);
  const nextEntry = pendingEntries.length > 0 ? Math.min(...pendingEntries.map(e => e.entryNumber)) : null;
  const winner = entries.find(e => e.isWinner);

  const getParticipantForEntry = (entryNumber: number) => {
    for (const p of party.participants) {
      if (p.assignments.some((a) => a.entryNumber === entryNumber)) {
        return p.user.name || p.user.email.split("@")[0];
      }
    }
    return "Not assigned";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Header />

      {/* Page Header */}
      <div className="border-b border-gray-700 bg-gray-900/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link href={`/party/${id}`} className="text-gray-400 hover:text-white text-sm">
                &larr; Back to Party
              </Link>
              <h1 className="text-2xl font-bold text-white">Host Controls</h1>
              <p className="text-gray-400">{party.name} - {party.event.name}</p>
            </div>
            <ScoreboardDropdown partyId={id} />
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Lobby State - Just the Players card, no Distribute Numbers card */}
        {party.status === "LOBBY" && (
          <Card className="bg-gray-800/50 border-gray-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white">Players ({party.participants.length})</CardTitle>
              <CardDescription className="text-gray-400">
                Remove players before starting the game if needed.
                {party.participants.length > 0 && ` Each person will get ${Math.floor(30 / party.participants.length)}-${Math.ceil(30 / party.participants.length)} numbers.`}
              </CardDescription>
              {party.entryFee && party.entryFee > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-green-400 font-medium">${party.entryFee.toFixed(2)} entry fee</span>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-400 text-sm">
                    {party.participants.filter(p => p.hasPaid).length}/{party.participants.length} paid
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {party.participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center p-3 rounded-lg bg-gray-700/30"
                  >
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        name={p.user.name}
                        email={p.user.email}
                        profileImageUrl={p.user.profileImageUrl}
                        size="sm"
                      />
                      <span className="text-white">{p.user.name || p.user.email}</span>
                      {p.user.id === party.hostId && (
                        <Badge variant="outline" className="text-yellow-500 border-yellow-500 text-xs">Host</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Payment status toggle (only show if entry fee is set) */}
                      {party.entryFee && party.entryFee > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePayment(p.id, p.hasPaid)}
                          disabled={updatingPayment === p.id}
                          className={p.hasPaid
                            ? "text-green-400 hover:text-green-300 hover:bg-green-500/20"
                            : "text-red-400 hover:text-red-300 hover:bg-red-500/20"
                          }
                        >
                          {updatingPayment === p.id ? "..." : p.hasPaid ? "✓ Paid" : "✗ Unpaid"}
                        </Button>
                      )}
                      {p.user.id !== party.hostId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveParticipant(p.id)}
                          disabled={removingParticipant === p.id}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                        >
                          {removingParticipant === p.id ? "Removing..." : "Remove"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Mode Section - Only in LOBBY */}
        {party.status === "LOBBY" && (
          <Card className="bg-orange-500/10 border-orange-500/50 mb-8">
            <CardHeader
              className="cursor-pointer"
              onClick={() => setTestModeExpanded(!testModeExpanded)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-orange-400 text-lg">Test Mode</CardTitle>
                  <Badge variant="outline" className="text-orange-400 border-orange-400 text-xs">Dev</Badge>
                </div>
                <span className="text-orange-400">{testModeExpanded ? "▼" : "▶"}</span>
              </div>
              <CardDescription className="text-gray-400">
                Add fake players to test the party flow
              </CardDescription>
            </CardHeader>
            {testModeExpanded && (
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleTestModeAction("addPlayers", 5)}
                    disabled={testModeLoading}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {testModeLoading ? "..." : "Add 5 Test Players"}
                  </Button>
                  <Button
                    onClick={() => handleTestModeAction("addPlayers", 10)}
                    disabled={testModeLoading}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {testModeLoading ? "..." : "Add 10 Test Players"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleTestModeAction("refreshProfileImages")}
                    disabled={testModeLoading}
                    variant="outline"
                    className="border-blue-500 text-blue-400 hover:bg-blue-500/20"
                  >
                    {testModeLoading ? "..." : "Refresh Profile Images"}
                  </Button>
                  <Button
                    onClick={() => handleTestModeAction("removeTestPlayers")}
                    disabled={testModeLoading}
                    variant="outline"
                    className="border-orange-500 text-orange-400 hover:bg-orange-500/20"
                  >
                    {testModeLoading ? "..." : "Remove Test Players"}
                  </Button>
                  <Button
                    onClick={() => handleTestModeAction("reset")}
                    disabled={testModeLoading}
                    variant="outline"
                    className="border-red-500 text-red-400 hover:bg-red-500/20"
                  >
                    {testModeLoading ? "..." : "Reset Party"}
                  </Button>
                </div>
                <p className="text-gray-500 text-xs">
                  Test players use @test.local emails and cannot log in. They will be assigned numbers like real players.
                </p>
              </CardContent>
            )}
          </Card>
        )}

        {/* Numbers Distributed but Event Not Started */}
        {party.status !== "LOBBY" && party.event.status === "NOT_STARTED" && (
          <Card className="bg-blue-500/20 border-blue-500 mb-8">
            <CardContent className="py-6">
              <div className="text-center">
                <p className="text-blue-400 text-sm font-medium mb-2">NUMBERS DISTRIBUTED</p>
                <p className="text-xl text-white mb-2">Waiting for the event to start</p>
                <p className="text-gray-400">
                  The admin will update wrestlers and eliminations during the match.
                  This page will update automatically.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Match Display */}
        {party.status !== "LOBBY" && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Next Entry / Active Wrestlers */}
            <div className="lg:col-span-2">
              {nextEntry && !winner && party.event.status === "IN_PROGRESS" && (
                <Card className="bg-yellow-500/20 border-yellow-500 mb-6">
                  <CardContent className="py-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-yellow-500 text-sm font-medium">NEXT ENTRY</p>
                        <p className="text-4xl font-bold text-white">#{nextEntry}</p>
                        <p className="text-gray-400">
                          Assigned to: {getParticipantForEntry(nextEntry)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Active Wrestlers */}
              <Card className="bg-gray-800/50 border-gray-700 mb-6">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    In The Ring
                    <Badge className="bg-green-500">{activeWrestlers.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activeWrestlers.length === 0 ? (
                    <p className="text-gray-400">No wrestlers currently in the ring</p>
                  ) : (
                    <div className="space-y-2">
                      {activeWrestlers
                        .sort((a, b) => a.entryNumber - b.entryNumber)
                        .map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl font-bold text-white">#{entry.entryNumber}</span>
                              <div>
                                <p className="text-white font-medium">{entry.wrestlerName}</p>
                                <p className="text-gray-400 text-sm">
                                  {getParticipantForEntry(entry.entryNumber)}
                                </p>
                              </div>
                            </div>
                            <Badge className="bg-green-500">Active</Badge>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Winner Banner */}
              {winner && (
                <Card className="bg-yellow-500/20 border-yellow-500 mb-6">
                  <CardContent className="py-8 text-center">
                    <p className="text-yellow-500 text-sm font-medium mb-2">ROYAL RUMBLE WINNER</p>
                    <p className="text-4xl font-bold text-white mb-2">
                      {winner.wrestlerName}
                    </p>
                    <p className="text-gray-300">
                      #{winner.entryNumber} - {getParticipantForEntry(winner.entryNumber)}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Admin Link */}
              {session?.user?.isAdmin && (
                <Card className="bg-purple-500/20 border-purple-500">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-300 text-sm">You are an admin</p>
                        <p className="text-white">Manage entries for this event in the admin panel</p>
                      </div>
                      <Link href={`/admin/event/${party.event.id}`}>
                        <Button className="bg-purple-600 hover:bg-purple-700">
                          Manage Event
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Entry Tracker */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Entry Tracker</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-6 gap-2">
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => {
                      const entry = entries.find(e => e.entryNumber === num);
                      let bgColor = "bg-gray-700";
                      if (entry?.isWinner) bgColor = "bg-yellow-500";
                      else if (entry?.eliminatedAt) bgColor = "bg-red-500/50";
                      else if (entry?.wrestlerName) bgColor = "bg-green-500";

                      return (
                        <div
                          key={num}
                          className={`${bgColor} rounded p-2 text-center text-white text-sm font-bold`}
                          title={entry?.wrestlerName || `Entry #${num}`}
                        >
                          {num}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-4 mt-4 text-xs">
                    <span className="flex items-center gap-1 text-gray-300">
                      <span className="w-3 h-3 bg-gray-700 rounded"></span> Pending
                    </span>
                    <span className="flex items-center gap-1 text-gray-300">
                      <span className="w-3 h-3 bg-green-500 rounded"></span> Active
                    </span>
                    <span className="flex items-center gap-1 text-gray-300">
                      <span className="w-3 h-3 bg-red-500/50 rounded"></span> Out
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Eliminations */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Recent Eliminations</CardTitle>
                </CardHeader>
                <CardContent>
                  {eliminatedWrestlers.length === 0 ? (
                    <p className="text-gray-400 text-sm">No eliminations yet</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {eliminatedWrestlers
                        .sort((a, b) => new Date(b.eliminatedAt!).getTime() - new Date(a.eliminatedAt!).getTime())
                        .slice(0, 10)
                        .map((entry) => (
                          <div key={entry.id} className="p-2 bg-red-500/10 rounded border border-red-500/30">
                            <p className="text-white text-sm">
                              <span className="font-bold">#{entry.entryNumber}</span> {entry.wrestlerName}
                            </p>
                            <p className="text-gray-400 text-xs">
                              by {entry.eliminatedBy} ({getParticipantForEntry(entry.entryNumber)})
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Participants */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">
                    Participants ({party.participants.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {party.participants.map((p) => {
                      const participantEntries = p.assignments.map(a =>
                        entries.find(e => e.entryNumber === a.entryNumber)
                      );
                      const activeCount = participantEntries.filter(
                        e => e?.wrestlerName && !e?.eliminatedAt
                      ).length;
                      const hasWinner = participantEntries.some(e => e?.isWinner);

                      return (
                        <div
                          key={p.id}
                          className="flex justify-between items-center p-2 rounded bg-gray-700/30"
                        >
                          <div className="flex items-center gap-2">
                          <UserAvatar
                            name={p.user.name}
                            email={p.user.email}
                            profileImageUrl={p.user.profileImageUrl}
                            size="sm"
                          />
                          <span className="text-white">{p.user.name || p.user.email}</span>
                        </div>
                          {hasWinner ? (
                            <Badge className="bg-yellow-500">Winner!</Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">{activeCount} active</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Test Player Utilities - Always available for hosts */}
        {party.participants.some(p => p.user.email.endsWith("@test.local")) && (
          <Card className="bg-blue-500/10 border-blue-500/50 mt-8">
            <CardHeader>
              <CardTitle className="text-blue-400 text-lg">Test Player Utilities</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleTestModeAction("refreshProfileImages")}
                disabled={testModeLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {testModeLoading ? "Updating..." : "Refresh Profile Images"}
              </Button>
              <p className="text-gray-500 text-xs mt-2">
                Updates all test players with DiceBear avatars. Use this if profile images aren&apos;t showing on the TV scoreboard.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Danger Zone */}
        <Card className="bg-red-500/10 border-red-500/50 mt-8">
          <CardHeader>
            <CardTitle className="text-red-400 text-lg">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete Party
            </Button>
            <p className="text-gray-500 text-xs mt-2">
              Permanently delete this party and all participant data.
            </p>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">Delete Party</DialogTitle>
              <DialogDescription className="text-gray-400">
                Are you sure you want to delete &quot;{party.name}&quot;? This action cannot be undone.
                All participant data and assignments will be permanently removed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleting}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteParty}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Party"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
