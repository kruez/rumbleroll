"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
  user: { id: string; name: string | null; email: string };
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
  const [distributing, setDistributing] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
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
              <p className="text-gray-400">{party.name} - {party.event.name}</p>
            </div>
            <Link href={`/party/${id}/tv`}>
              <Button variant="outline" className="bg-transparent border-white text-white hover:bg-white/10">
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
                          <span className="text-white">{p.user.name || p.user.email}</span>
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
      </main>
    </div>
  );
}
