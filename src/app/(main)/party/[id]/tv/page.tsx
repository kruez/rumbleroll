"use client";

import { useEffect, useState, use, useCallback } from "react";
import { Badge } from "@/components/ui/badge";

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
  status: "LOBBY" | "NUMBERS_ASSIGNED" | "COMPLETED";
  event: RumbleEvent;
  participants: Participant[];
}

export default function TVDisplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchParty = useCallback(async () => {
    try {
      const res = await fetch(`/api/parties/${id}`);
      if (res.ok) {
        const data = await res.json();
        setParty(data);
      }
    } catch (error) {
      console.error("Failed to fetch party:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchParty();
    // Poll for updates every 3 seconds
    const interval = setInterval(fetchParty, 3000);
    return () => clearInterval(interval);
  }, [fetchParty]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-2xl">Loading...</p>
      </div>
    );
  }

  if (!party) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-2xl">Party not found</p>
      </div>
    );
  }

  const entries = party.event.entries;

  // Calculate standings
  const standings = party.participants
    .map((p) => {
      const activeCount = p.assignments.filter((a) => {
        const entry = entries.find(e => e.entryNumber === a.entryNumber);
        return entry?.wrestlerName && !entry?.eliminatedAt;
      }).length;
      const hasWinner = p.assignments.some((a) => {
        const entry = entries.find(e => e.entryNumber === a.entryNumber);
        return entry?.isWinner;
      });
      return {
        ...p,
        activeCount,
        hasWinner,
        displayName: p.user.name || p.user.email.split("@")[0],
      };
    })
    .sort((a, b) => {
      if (a.hasWinner) return -1;
      if (b.hasWinner) return 1;
      return b.activeCount - a.activeCount;
    });

  const activeWrestlers = entries
    .filter((e) => e.wrestlerName && !e.eliminatedAt && !e.isWinner)
    .sort((a, b) => a.entryNumber - b.entryNumber);

  const recentEliminations = entries
    .filter((e) => e.eliminatedAt)
    .sort((a, b) => new Date(b.eliminatedAt!).getTime() - new Date(a.eliminatedAt!).getTime())
    .slice(0, 5);

  const winner = entries.find((e) => e.isWinner);

  const getParticipantForEntry = (entryNumber: number) => {
    for (const p of party.participants) {
      if (p.assignments.some((a) => a.entryNumber === entryNumber)) {
        return p.user.name || p.user.email.split("@")[0];
      }
    }
    return "Unknown";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6 overflow-hidden">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-2">{party.event.name}</h1>
        <p className="text-xl text-purple-300">{party.name}</p>
      </div>

      {/* Winner Celebration */}
      {winner && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-pulse">
          <div className="text-center">
            <p className="text-yellow-400 text-2xl mb-4">ROYAL RUMBLE WINNER</p>
            <p className="text-8xl font-black text-white mb-4">{winner.wrestlerName}</p>
            <p className="text-3xl text-yellow-400">
              #{winner.entryNumber} - {getParticipantForEntry(winner.entryNumber)}
            </p>
          </div>
        </div>
      )}

      {party.status === "LOBBY" ? (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <p className="text-4xl text-white mb-4">Waiting for players...</p>
            <p className="text-2xl text-gray-400">{party.participants.length} joined</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-180px)]">
          {/* Standings - Left Column */}
          <div className="col-span-4 bg-black/30 rounded-xl p-4 overflow-hidden">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              STANDINGS
              <Badge className="bg-purple-600">{party.participants.length} players</Badge>
            </h2>
            <div className="space-y-3 overflow-y-auto max-h-[calc(100%-3rem)]">
              {standings.map((p, idx) => {
                const activeNumbers = p.assignments
                  .filter((a) => {
                    const entry = entries.find(e => e.entryNumber === a.entryNumber);
                    return entry?.wrestlerName && !entry?.eliminatedAt;
                  })
                  .map((a) => a.entryNumber);

                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      p.hasWinner
                        ? "bg-yellow-500/30 border-2 border-yellow-500"
                        : p.activeCount > 0
                        ? "bg-green-500/20 border border-green-500/50"
                        : "bg-gray-800/50 border border-gray-700 opacity-60"
                    }`}
                  >
                    <span className="text-2xl font-bold text-white w-8">{idx + 1}</span>
                    <div className="flex-1">
                      <p className="text-white font-bold text-lg">{p.displayName}</p>
                      <div className="flex gap-1 flex-wrap">
                        {activeNumbers.map((num) => (
                          <Badge key={num} className="bg-green-600 text-xs">
                            #{num}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      {p.hasWinner ? (
                        <Badge className="bg-yellow-500 text-black font-bold">WINNER</Badge>
                      ) : (
                        <span className="text-3xl font-black text-white">{p.activeCount}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Center Column */}
          <div className="col-span-5 flex flex-col gap-6">
            {/* In The Ring */}
            <div className="bg-black/30 rounded-xl p-4 flex-1 overflow-hidden">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                IN THE RING
                <Badge className="bg-green-500">{activeWrestlers.length}</Badge>
              </h2>
              <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[calc(100%-3rem)]">
                {activeWrestlers.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-green-500/20 border border-green-500 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-green-400">#{entry.entryNumber}</span>
                      <span className="text-white font-medium truncate">{entry.wrestlerName}</span>
                    </div>
                    <p className="text-green-300 text-sm">{getParticipantForEntry(entry.entryNumber)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Entry Tracker */}
            <div className="bg-black/30 rounded-xl p-4">
              <h2 className="text-xl font-bold text-white mb-3">ENTRY TRACKER</h2>
              <div className="grid grid-cols-10 gap-2">
                {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => {
                  const entry = entries.find((e) => e.entryNumber === num);
                  let bgColor = "bg-gray-700";
                  let textColor = "text-gray-400";
                  if (entry?.isWinner) {
                    bgColor = "bg-yellow-500";
                    textColor = "text-black";
                  } else if (entry?.eliminatedAt) {
                    bgColor = "bg-red-600/50";
                    textColor = "text-red-300";
                  } else if (entry?.wrestlerName) {
                    bgColor = "bg-green-500";
                    textColor = "text-white";
                  }

                  return (
                    <div
                      key={num}
                      className={`${bgColor} ${textColor} rounded-lg p-2 text-center font-bold text-lg aspect-square flex items-center justify-center`}
                    >
                      {num}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Elimination Feed - Right Column */}
          <div className="col-span-3 bg-black/30 rounded-xl p-4 overflow-hidden">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              ELIMINATIONS
              <Badge className="bg-red-500">
                {entries.filter((e) => e.eliminatedAt).length}
              </Badge>
            </h2>
            <div className="space-y-3 overflow-y-auto max-h-[calc(100%-3rem)]">
              {recentEliminations.length === 0 ? (
                <p className="text-gray-500">No eliminations yet</p>
              ) : (
                recentEliminations.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-red-500/20 border border-red-500/50 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold text-red-400">#{entry.entryNumber}</span>
                      <span className="text-white font-medium">{entry.wrestlerName}</span>
                    </div>
                    <p className="text-gray-400 text-sm">
                      by <span className="text-red-300">{entry.eliminatedBy}</span>
                    </p>
                    <p className="text-gray-500 text-xs">{getParticipantForEntry(entry.entryNumber)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
