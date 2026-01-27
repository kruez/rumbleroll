"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Entry {
  id: string;
  entryNumber: number;
  wrestlerName: string | null;
  enteredAt: string | null;
  eliminatedAt: string | null;
  eliminatedBy: string | null;
  isWinner: boolean;
  assignment?: {
    participant: {
      user: { id: string; name: string | null; email: string };
    };
  } | null;
}

interface Party {
  id: string;
  name: string;
  eventName: string;
  inviteCode: string;
  status: "LOBBY" | "NUMBERS_ASSIGNED" | "IN_PROGRESS" | "COMPLETED";
  hostId: string;
  participants: Array<{
    id: string;
    user: { id: string; name: string | null; email: string };
  }>;
  entries: Entry[];
  isHost: boolean;
}

export default function AdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [distributing, setDistributing] = useState(false);

  // Entry dialog state
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [wrestlerName, setWrestlerName] = useState("");
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);

  // Elimination dialog state
  const [eliminateEntry, setEliminateEntry] = useState<Entry | null>(null);
  const [eliminatedBy, setEliminatedBy] = useState("");
  const [eliminateDialogOpen, setEliminateDialogOpen] = useState(false);

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
  }, [fetchParty]);

  const handleDistribute = async () => {
    setDistributing(true);
    try {
      const res = await fetch(`/api/parties/${id}/distribute`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to distribute numbers");
        return;
      }
      toast.success("Numbers distributed successfully!");
      fetchParty();
    } catch {
      toast.error("Failed to distribute numbers");
    } finally {
      setDistributing(false);
    }
  };

  const handleSetWrestler = async () => {
    if (!selectedEntry) return;

    try {
      const res = await fetch(`/api/parties/${id}/entries`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryNumber: selectedEntry.entryNumber,
          wrestlerName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to update entry");
        return;
      }

      toast.success(`#${selectedEntry.entryNumber} - ${wrestlerName} has entered!`);
      setEntryDialogOpen(false);
      setSelectedEntry(null);
      setWrestlerName("");
      fetchParty();
    } catch {
      toast.error("Failed to update entry");
    }
  };

  const handleEliminate = async () => {
    if (!eliminateEntry) return;

    try {
      const res = await fetch(`/api/parties/${id}/entries`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryNumber: eliminateEntry.entryNumber,
          eliminatedBy,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to eliminate");
        return;
      }

      toast.success(`${eliminateEntry.wrestlerName} has been eliminated!`);
      setEliminateDialogOpen(false);
      setEliminateEntry(null);
      setEliminatedBy("");
      fetchParty();
    } catch {
      toast.error("Failed to eliminate");
    }
  };

  const handleDeclareWinner = async (entry: Entry) => {
    try {
      const res = await fetch(`/api/parties/${id}/entries`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryNumber: entry.entryNumber,
          isWinner: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to declare winner");
        return;
      }

      toast.success(`${entry.wrestlerName} wins the Royal Rumble!`);
      fetchParty();
    } catch {
      toast.error("Failed to declare winner");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (!party) return null;

  const activeWrestlers = party.entries.filter(e => e.wrestlerName && !e.eliminatedAt && !e.isWinner);
  const eliminatedWrestlers = party.entries.filter(e => e.eliminatedAt);
  const pendingEntries = party.entries.filter(e => !e.wrestlerName);
  const nextEntry = pendingEntries.length > 0 ? Math.min(...pendingEntries.map(e => e.entryNumber)) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link href={`/party/${id}`} className="text-gray-400 hover:text-white text-sm">
                &larr; Back to Party
              </Link>
              <h1 className="text-2xl font-bold text-white">Host Controls</h1>
              <p className="text-gray-400">{party.name} - {party.eventName}</p>
            </div>
            <Link href={`/party/${id}/tv`}>
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                Open TV Display
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Lobby State */}
        {party.status === "LOBBY" && (
          <Card className="bg-gray-800/50 border-gray-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white">Ready to Start?</CardTitle>
              <CardDescription className="text-gray-400">
                {party.participants.length} participant{party.participants.length !== 1 ? "s" : ""} have joined.
                Distribute numbers when everyone is ready.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleDistribute}
                  disabled={distributing || party.participants.length === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {distributing ? "Distributing..." : "Distribute Numbers"}
                </Button>
                <p className="text-gray-400 text-sm">
                  Each person will get {Math.floor(30 / party.participants.length)}-{Math.ceil(30 / party.participants.length)} numbers
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Entry Grid */}
        {party.status !== "LOBBY" && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Next Entry */}
            <div className="lg:col-span-2">
              {nextEntry && (
                <Card className="bg-yellow-500/20 border-yellow-500 mb-6">
                  <CardContent className="py-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-yellow-500 text-sm font-medium">NEXT ENTRY</p>
                        <p className="text-4xl font-bold text-white">#{nextEntry}</p>
                        <p className="text-gray-400">
                          Assigned to: {party.entries.find(e => e.entryNumber === nextEntry)?.assignment?.participant.user.name || "Unknown"}
                        </p>
                      </div>
                      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            size="lg"
                            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                            onClick={() => {
                              setSelectedEntry(party.entries.find(e => e.entryNumber === nextEntry) || null);
                              setWrestlerName("");
                            }}
                          >
                            Enter Wrestler
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Entry #{selectedEntry?.entryNumber}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Wrestler Name</Label>
                              <Input
                                placeholder="e.g., John Cena"
                                value={wrestlerName}
                                onChange={(e) => setWrestlerName(e.target.value)}
                                autoFocus
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleSetWrestler} disabled={!wrestlerName.trim()}>
                              Confirm Entry
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
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
                                  {entry.assignment?.participant.user.name || "Unknown"}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Dialog open={eliminateDialogOpen && eliminateEntry?.id === entry.id} onOpenChange={(open) => {
                                setEliminateDialogOpen(open);
                                if (!open) setEliminateEntry(null);
                              }}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      setEliminateEntry(entry);
                                      setEliminatedBy("");
                                    }}
                                  >
                                    Eliminate
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Eliminate {eliminateEntry?.wrestlerName}</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label>Eliminated By</Label>
                                      <Select value={eliminatedBy} onValueChange={setEliminatedBy}>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select who eliminated them" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {activeWrestlers
                                            .filter(w => w.id !== eliminateEntry?.id)
                                            .map(w => (
                                              <SelectItem key={w.id} value={w.wrestlerName || ""}>
                                                {w.wrestlerName}
                                              </SelectItem>
                                            ))}
                                          <SelectItem value="Self">Self Elimination</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button variant="destructive" onClick={handleEliminate} disabled={!eliminatedBy}>
                                      Confirm Elimination
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              {activeWrestlers.length === 1 && (
                                <Button
                                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                                  size="sm"
                                  onClick={() => handleDeclareWinner(entry)}
                                >
                                  Declare Winner
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Winner Banner */}
              {party.status === "COMPLETED" && (
                <Card className="bg-yellow-500/20 border-yellow-500 mb-6">
                  <CardContent className="py-8 text-center">
                    <p className="text-yellow-500 text-sm font-medium mb-2">ROYAL RUMBLE WINNER</p>
                    <p className="text-4xl font-bold text-white mb-2">
                      {party.entries.find(e => e.isWinner)?.wrestlerName}
                    </p>
                    <p className="text-gray-300">
                      #{party.entries.find(e => e.isWinner)?.entryNumber} - {party.entries.find(e => e.isWinner)?.assignment?.participant.user.name}
                    </p>
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
                      const entry = party.entries.find(e => e.entryNumber === num);
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
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-gray-700 rounded"></span> Pending
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-green-500 rounded"></span> Active
                    </span>
                    <span className="flex items-center gap-1">
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
                            <p className="text-gray-400 text-xs">by {entry.eliminatedBy}</p>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
