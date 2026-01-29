"use client";

import { useEffect, useState, use, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
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
      const participantEntries = p.assignments.map((a) =>
        entries.find(e => e.entryNumber === a.entryNumber)
      );
      const waitingCount = participantEntries.filter(e => !e?.wrestlerName).length;
      const activeCount = participantEntries.filter(
        e => e?.wrestlerName && !e?.eliminatedAt && !e?.isWinner
      ).length;
      const eliminatedCount = participantEntries.filter(e => e?.eliminatedAt).length;
      const hasWinner = participantEntries.some(e => e?.isWinner);
      return {
        ...p,
        waitingCount,
        activeCount,
        eliminatedCount,
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
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 overflow-hidden">
          {/* Spotlight effect */}
          <div className="absolute inset-0 bg-gradient-radial from-yellow-500/30 via-transparent to-transparent animate-pulse" />

          {/* Animated sparkles */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random()}s`,
                }}
              />
            ))}
          </div>

          <div className="text-center relative z-10 animate-[fadeIn_1s_ease-out]">
            {/* Championship Belt SVG */}
            <div className="mb-8 flex justify-center">
              <svg viewBox="0 0 200 120" className="w-64 h-40 drop-shadow-[0_0_30px_rgba(234,179,8,0.8)]">
                {/* Main belt plate */}
                <ellipse cx="100" cy="60" rx="85" ry="45" fill="url(#beltGold)" stroke="#B8860B" strokeWidth="3"/>
                {/* Inner decoration */}
                <ellipse cx="100" cy="60" rx="65" ry="32" fill="none" stroke="#B8860B" strokeWidth="2"/>
                <ellipse cx="100" cy="60" rx="50" ry="25" fill="url(#beltInner)" stroke="#FFD700" strokeWidth="1"/>
                {/* Center gem */}
                <circle cx="100" cy="60" r="15" fill="#DC143C" stroke="#FFD700" strokeWidth="2"/>
                <circle cx="100" cy="60" r="8" fill="#FF6B6B" opacity="0.6"/>
                {/* Side plates */}
                <rect x="10" y="40" width="25" height="40" rx="5" fill="url(#beltGold)" stroke="#B8860B" strokeWidth="2"/>
                <rect x="165" y="40" width="25" height="40" rx="5" fill="url(#beltGold)" stroke="#B8860B" strokeWidth="2"/>
                {/* Stars */}
                <polygon points="50,55 52,61 58,61 53,65 55,71 50,67 45,71 47,65 42,61 48,61" fill="#FFD700"/>
                <polygon points="150,55 152,61 158,61 153,65 155,71 150,67 145,71 147,65 142,61 148,61" fill="#FFD700"/>
                {/* Crown on top */}
                <path d="M75,25 L80,35 L90,30 L100,40 L110,30 L120,35 L125,25 L120,45 L80,45 Z" fill="url(#beltGold)" stroke="#B8860B" strokeWidth="1"/>
                <defs>
                  <linearGradient id="beltGold" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FFD700"/>
                    <stop offset="50%" stopColor="#FFA500"/>
                    <stop offset="100%" stopColor="#FFD700"/>
                  </linearGradient>
                  <linearGradient id="beltInner" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#2D2D2D"/>
                    <stop offset="100%" stopColor="#1A1A1A"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <p className="text-yellow-400 text-3xl font-bold mb-4 tracking-widest animate-pulse">
              ROYAL RUMBLE WINNER
            </p>
            <p className="text-8xl font-black text-white mb-6 drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] animate-[scaleIn_0.5s_ease-out]">
              {winner.wrestlerName}
            </p>
            <div className="flex items-center justify-center gap-4">
              <span className="text-4xl font-bold text-yellow-300">#{winner.entryNumber}</span>
              <span className="text-3xl text-white">-</span>
              <span className="text-3xl text-yellow-400 font-bold">{getParticipantForEntry(winner.entryNumber)}</span>
            </div>
          </div>
        </div>
      )}

      {party.status === "LOBBY" ? (
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <div className="text-center mb-12 flex items-center gap-12">
            <div>
              <p className="text-2xl text-purple-300 mb-2">Join Code</p>
              <p className="text-8xl font-mono font-bold text-white tracking-widest">{party.inviteCode}</p>
            </div>
            <div className="bg-white p-4 rounded-xl">
              <QRCodeSVG
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/join?code=${party.inviteCode}`}
                size={180}
                bgColor="white"
                fgColor="black"
              />
            </div>
          </div>

          <div className="bg-black/30 rounded-xl p-8 max-w-2xl w-full">
            <h2 className="text-2xl font-bold text-white mb-4 text-center">
              Players ({party.participants.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {party.participants.map((p) => (
                <div key={p.id} className="bg-purple-500/20 border border-purple-500/50 rounded-lg p-3 flex items-center justify-center gap-2">
                  <UserAvatar
                    name={p.user.name}
                    email={p.user.email}
                    profileImageUrl={p.user.profileImageUrl}
                    size="sm"
                  />
                  <p className="text-white font-medium">{p.user.name || p.user.email.split("@")[0]}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xl text-gray-400 mt-8">Waiting for host to start...</p>
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
                    <UserAvatar
                      name={p.user.name}
                      email={p.user.email}
                      profileImageUrl={p.user.profileImageUrl}
                      size="sm"
                    />
                    <div className="flex-1">
                      <p className="text-white font-bold text-lg">{p.displayName}</p>
                      <div className="flex gap-1 flex-wrap">
                        {activeNumbers.map((num) => (
                          <Badge key={num} className="bg-green-600 text-xs">
                            #{num}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {p.waitingCount} waiting | {p.activeCount} active | {p.eliminatedCount} eliminated
                      </p>
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
