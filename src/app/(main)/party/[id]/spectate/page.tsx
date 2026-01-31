"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/UserAvatar";

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
  user: { id: string; name: string; profileImageUrl?: string | null };
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
  status: "LOBBY" | "NUMBERS_ASSIGNED" | "COMPLETED";
  entryFee: number | null;
  hostId: string;
  host: { id: string; name: string | null };
  event: RumbleEvent;
  participants: Participant[];
}

export default function SpectatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchParty = useCallback(async () => {
    if (!code) {
      setError("Missing invite code");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/parties/${id}/public?code=${code}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load party");
        return;
      }
      const data = await res.json();
      setParty(data);
    } catch {
      setError("Failed to load party");
    } finally {
      setLoading(false);
    }
  }, [id, code]);

  useEffect(() => {
    fetchParty();
    const interval = setInterval(fetchParty, 5000);
    return () => clearInterval(interval);
  }, [fetchParty]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (error || !party) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-8 text-center">
            <p className="text-red-400 mb-4">{error || "Party not found"}</p>
            <Link href="/">
              <Button>Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const entries = party.event.entries;
  const activeWrestlers = entries.filter(e => e.wrestlerName && !e.eliminatedAt && !e.isWinner);
  const eliminatedWrestlers = entries.filter(e => e.eliminatedAt);
  const pendingEntries = entries.filter(e => !e.wrestlerName);
  const nextEntry = pendingEntries.length > 0 ? Math.min(...pendingEntries.map(e => e.entryNumber)) : null;
  const winner = entries.find(e => e.isWinner);

  const getParticipantForEntry = (entryNumber: number) => {
    for (const p of party.participants) {
      if (p.assignments.some((a) => a.entryNumber === entryNumber)) {
        return p.user.name;
      }
    }
    return "Not assigned";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Spectator Header */}
      <div className="border-b border-gray-700 bg-gray-900/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-purple-400 border-purple-400 text-xs">
                  Spectator View
                </Badge>
              </div>
              <h1 className="text-2xl font-bold text-white">{party.name}</h1>
              <p className="text-gray-400">{party.event.name}</p>
            </div>
            {party.entryFee && (
              <div className="text-right">
                <span className="text-sm text-gray-400">Entry Fee</span>
                <p className="text-xl font-bold text-green-400">${party.entryFee.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Lobby State */}
        {party.status === "LOBBY" && (
          <Card className="bg-gray-800/50 border-gray-700 mb-8">
            <CardContent className="py-12 text-center">
              <p className="text-2xl text-white mb-2">Waiting to Start</p>
              <p className="text-gray-400">
                {party.participants.length} participant{party.participants.length !== 1 ? "s" : ""} have joined
              </p>
              <p className="text-gray-500 text-sm mt-4">
                The host will start the party once everyone has joined.
              </p>
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
                  This page will update automatically when the match begins.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Winner Banner */}
        {winner && (
          <Card className="bg-yellow-500/20 border-yellow-500 mb-8">
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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Next Entry */}
            {party.status !== "LOBBY" && nextEntry && !winner && party.event.status === "IN_PROGRESS" && (
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
            {party.status !== "LOBBY" && (
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
            )}

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
                  <span className="flex items-center gap-1 text-gray-300">
                    <span className="w-3 h-3 bg-yellow-500 rounded"></span> Winner
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Match Progress */}
            {party.status !== "LOBBY" && (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Match Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Entered</span>
                      <span className="text-white font-bold">
                        {entries.filter(e => e.wrestlerName).length} / 30
                      </span>
                    </div>
                    <Separator className="bg-gray-700" />
                    <div className="flex justify-between">
                      <span className="text-gray-400">Eliminated</span>
                      <span className="text-white font-bold">
                        {entries.filter(e => e.eliminatedAt).length}
                      </span>
                    </div>
                    <Separator className="bg-gray-700" />
                    <div className="flex justify-between">
                      <span className="text-gray-400">In Ring</span>
                      <span className="text-white font-bold">
                        {entries.filter(e => e.wrestlerName && !e.eliminatedAt).length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Participants */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Participants ({party.participants.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {party.participants.map((participant) => {
                    const participantEntries = participant.assignments.map(a =>
                      entries.find(e => e.entryNumber === a.entryNumber)
                    );
                    const activeCount = participantEntries.filter(
                      e => e?.wrestlerName && !e?.eliminatedAt
                    ).length;
                    const hasWinner = participantEntries.some(e => e?.isWinner);

                    return (
                      <div
                        key={participant.id}
                        className="flex justify-between items-center p-2 rounded bg-gray-700/30"
                      >
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            name={participant.user.name}
                            email=""
                            profileImageUrl={participant.user.profileImageUrl}
                            size="sm"
                          />
                          <span className="text-white">{participant.user.name}</span>
                          {participant.user.id === party.hostId && (
                            <Badge variant="outline" className="text-yellow-500 border-yellow-500 text-xs">Host</Badge>
                          )}
                        </div>
                        {party.status !== "LOBBY" && (
                          <div className="text-sm">
                            {hasWinner ? (
                              <Badge className="bg-yellow-500">Winner!</Badge>
                            ) : (
                              <span className="text-gray-400">
                                {activeCount} active
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent Eliminations */}
            {party.status !== "LOBBY" && eliminatedWrestlers.length > 0 && (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Recent Eliminations</CardTitle>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            )}

            {/* Join CTA */}
            <Card className="bg-purple-500/10 border-purple-500/50">
              <CardContent className="py-4 text-center">
                <p className="text-gray-400 text-sm mb-2">Want to join the action?</p>
                <Link href="/register">
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    Create an Account
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
