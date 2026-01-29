"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Entry {
  id: string;
  entryNumber: number;
  wrestlerName: string | null;
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
  user: { id: string; name: string | null; email: string; venmoHandle?: string | null; cashAppHandle?: string | null };
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
  event: RumbleEvent;
  participants: Participant[];
  isHost: boolean;
}

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchParty = async () => {
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
    };
    fetchParty();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (!party) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <p className="text-white">Party not found</p>
      </div>
    );
  }

  const entries = party.event.entries;
  const winner = entries.find((e) => e.isWinner);

  const getParticipantForEntry = (entryNumber: number) => {
    for (const p of party.participants) {
      if (p.assignments.some((a) => a.entryNumber === entryNumber)) {
        return p.user.name || p.user.email.split("@")[0];
      }
    }
    return "Unknown";
  };

  const getWinnerParticipant = () => {
    if (!winner) return null;
    for (const p of party.participants) {
      if (p.assignments.some((a) => a.entryNumber === winner.entryNumber)) {
        return p;
      }
    }
    return null;
  };

  const winnerParticipant = getWinnerParticipant();

  // Calculate final standings
  const standings = party.participants
    .map((p) => {
      const assignments = p.assignments.map((a) => {
        const entry = entries.find((e) => e.entryNumber === a.entryNumber);
        return { ...a, entry };
      });
      const winnerEntry = assignments.find((a) => a.entry?.isWinner);
      const lastElimination = assignments
        .filter((a) => a.entry?.eliminatedAt)
        .sort((a, b) => {
          const timeA = a.entry?.eliminatedAt ? new Date(a.entry.eliminatedAt).getTime() : 0;
          const timeB = b.entry?.eliminatedAt ? new Date(b.entry.eliminatedAt).getTime() : 0;
          return timeB - timeA;
        })[0];

      return {
        ...p,
        displayName: p.user.name || p.user.email.split("@")[0],
        hasWinner: !!winnerEntry,
        lastEliminatedAt: lastElimination?.entry?.eliminatedAt,
        totalAssigned: assignments.length,
      };
    })
    .sort((a, b) => {
      if (a.hasWinner) return -1;
      if (b.hasWinner) return 1;
      const timeA = a.lastEliminatedAt ? new Date(a.lastEliminatedAt).getTime() : 0;
      const timeB = b.lastEliminatedAt ? new Date(b.lastEliminatedAt).getTime() : 0;
      return timeB - timeA;
    });

  // Sort eliminations chronologically
  const eliminationOrder = entries
    .filter((e) => e.eliminatedAt)
    .sort((a, b) => new Date(a.eliminatedAt!).getTime() - new Date(b.eliminatedAt!).getTime());

  const isCompleted = party.event.status === "COMPLETED";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <Link href={`/party/${id}`} className="text-gray-400 hover:text-white text-sm">
            &larr; Back to Party
          </Link>
          <h1 className="text-2xl font-bold text-white">{party.name} Results</h1>
          <p className="text-gray-400">{party.event.name}</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!isCompleted ? (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-12 text-center">
              <p className="text-gray-400 text-xl">The match hasn&apos;t finished yet!</p>
              <Link href={`/party/${id}`}>
                <Button className="mt-4">Back to Party</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Winner Banner */}
            {winner && (
              <Card className="bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border-yellow-500">
                <CardContent className="py-12 text-center">
                  <p className="text-yellow-400 text-lg mb-2">ROYAL RUMBLE WINNER</p>
                  <p className="text-5xl font-black text-white mb-4">{winner.wrestlerName}</p>
                  <p className="text-xl text-yellow-300 mb-4">
                    Entry #{winner.entryNumber} - {getParticipantForEntry(winner.entryNumber)}
                  </p>
                  {party.entryFee && winnerParticipant && (
                    <div className="mt-6 pt-6 border-t border-yellow-500/30">
                      <p className="text-yellow-400 text-sm mb-3">Pay the winner:</p>
                      <div className="flex justify-center gap-4 flex-wrap">
                        {winnerParticipant.user.venmoHandle && (
                          <div className="px-4 py-2 bg-gray-900/50 rounded-lg">
                            <span className="text-blue-400 font-medium">Venmo: </span>
                            <span className="text-white">{winnerParticipant.user.venmoHandle}</span>
                          </div>
                        )}
                        {winnerParticipant.user.cashAppHandle && (
                          <div className="px-4 py-2 bg-gray-900/50 rounded-lg">
                            <span className="text-green-400 font-medium">Cash App: </span>
                            <span className="text-white">{winnerParticipant.user.cashAppHandle}</span>
                          </div>
                        )}
                        {!winnerParticipant.user.venmoHandle && !winnerParticipant.user.cashAppHandle && (
                          <p className="text-gray-400 text-sm">
                            Contact {winnerParticipant.user.name || winnerParticipant.user.email} directly
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Final Standings */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Final Standings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {standings.map((p, idx) => (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between p-4 rounded-lg ${
                          p.hasWinner
                            ? "bg-yellow-500/20 border border-yellow-500"
                            : "bg-gray-700/30"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span
                            className={`text-2xl font-bold ${
                              idx === 0 ? "text-yellow-400" : "text-gray-400"
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <div>
                            <p className="text-white font-bold text-lg">{p.displayName}</p>
                            <p className="text-gray-400 text-sm">
                              {p.totalAssigned} number{p.totalAssigned !== 1 ? "s" : ""} assigned
                            </p>
                          </div>
                        </div>
                        {p.hasWinner && (
                          <Badge className="bg-yellow-500 text-black font-bold">WINNER</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Elimination Timeline */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Elimination Order</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {eliminationOrder.map((entry, idx) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-4 p-3 bg-gray-700/30 rounded-lg"
                      >
                        <span className="text-gray-500 w-8">#{idx + 1}</span>
                        <div className="flex-1">
                          <p className="text-white">
                            <span className="font-bold">#{entry.entryNumber}</span> {entry.wrestlerName}
                          </p>
                          <p className="text-gray-400 text-sm">
                            {getParticipantForEntry(entry.entryNumber)} - eliminated by {entry.eliminatedBy}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* All Entries */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">All Entries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {entries
                    .filter((e) => e.wrestlerName)
                    .sort((a, b) => a.entryNumber - b.entryNumber)
                    .map((entry) => (
                      <div
                        key={entry.id}
                        className={`p-4 rounded-lg text-center ${
                          entry.isWinner
                            ? "bg-yellow-500/20 border border-yellow-500"
                            : "bg-gray-700/30"
                        }`}
                      >
                        <span className="text-2xl font-bold text-white">#{entry.entryNumber}</span>
                        <p className="text-white font-medium mt-1 truncate">{entry.wrestlerName}</p>
                        <p className="text-gray-400 text-sm truncate">
                          {getParticipantForEntry(entry.entryNumber)}
                        </p>
                        {entry.isWinner && (
                          <Badge className="bg-yellow-500 text-black mt-2">WINNER</Badge>
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
