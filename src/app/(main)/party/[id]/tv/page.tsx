"use client";

import { useEffect, useState, use, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { UserAvatar } from "@/components/UserAvatar";
import { Toaster } from "@/components/ui/sonner";
import {
  showEntryAnnouncement,
  showEliminationAnnouncement,
  showWinnerAnnouncement,
} from "@/components/tv/AnnouncementToast";

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

interface ReplayEvent {
  type: "entry" | "elimination" | "winner";
  entry: Entry;
  timestamp: number;
}

interface ReplayState {
  inRing: Set<string>;
  eliminated: string[];
}

export default function TVDisplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [animatingOut, setAnimatingOut] = useState<Set<string>>(new Set());

  // Replay mode state
  const [replayMode, setReplayMode] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayTimeline, setReplayTimeline] = useState<ReplayEvent[]>([]);
  const [replayState, setReplayState] = useState<ReplayState>({
    inRing: new Set(),
    eliminated: [],
  });
  const replayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const winnerTimestampRef = useRef<number | null>(null);

  // Track previous entries for detecting changes
  const prevEntriesRef = useRef<Entry[]>([]);
  const hasAnnouncedWinnerRef = useRef(false);

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

  // Detect entry/elimination changes and show announcements
  useEffect(() => {
    if (!party) return;

    const entries = party.event.entries;
    const prevEntries = prevEntriesRef.current;

    // Skip initial load (when prevEntries is empty)
    if (prevEntries.length > 0) {
      // Detect new entries
      for (const entry of entries) {
        const prevEntry = prevEntries.find((e) => e.id === entry.id);

        // New entry (wrestler just entered)
        if (entry.wrestlerName && (!prevEntry || !prevEntry.wrestlerName)) {
          showEntryAnnouncement({
            wrestlerName: entry.wrestlerName,
            entryNumber: entry.entryNumber,
          });
        }

        // New elimination
        if (entry.eliminatedAt && (!prevEntry || !prevEntry.eliminatedAt)) {
          if (entry.wrestlerName && entry.eliminatedBy) {
            // Add to animating out set
            setAnimatingOut((prev) => new Set(prev).add(entry.id));

            // Remove from animating set after animation completes (600ms)
            setTimeout(() => {
              setAnimatingOut((prev) => {
                const next = new Set(prev);
                next.delete(entry.id);
                return next;
              });
            }, 600);

            showEliminationAnnouncement({
              wrestlerName: entry.wrestlerName,
              eliminatedBy: entry.eliminatedBy,
              entryNumber: entry.entryNumber,
            });
          }
        }

        // Winner announced
        if (entry.isWinner && (!prevEntry || !prevEntry.isWinner) && !hasAnnouncedWinnerRef.current) {
          hasAnnouncedWinnerRef.current = true;
          if (entry.wrestlerName) {
            showWinnerAnnouncement(entry.wrestlerName, entry.entryNumber);
          }
        }
      }
    }

    // Update prev entries reference
    prevEntriesRef.current = entries;
  }, [party]);

  useEffect(() => {
    fetchParty();
    // Poll for updates every 3 seconds
    const interval = setInterval(fetchParty, 3000);
    return () => clearInterval(interval);
  }, [fetchParty]);

  // Build replay timeline from entries
  const buildReplayTimeline = useCallback((entries: Entry[]): ReplayEvent[] => {
    const events: ReplayEvent[] = [];

    for (const entry of entries) {
      if (entry.enteredAt && entry.wrestlerName) {
        events.push({
          type: "entry",
          entry,
          timestamp: new Date(entry.enteredAt).getTime(),
        });
      }
      if (entry.eliminatedAt) {
        events.push({
          type: "elimination",
          entry,
          timestamp: new Date(entry.eliminatedAt).getTime(),
        });
      }
      if (entry.isWinner) {
        events.push({
          type: "winner",
          entry,
          timestamp: entry.eliminatedAt
            ? new Date(entry.eliminatedAt).getTime() + 1
            : Date.now(),
        });
      }
    }

    return events.sort((a, b) => a.timestamp - b.timestamp);
  }, []);

  // Start replay mode 15 seconds after winner is announced
  useEffect(() => {
    if (!party) return;

    const winner = party.event.entries.find((e) => e.isWinner);

    if (winner && !winnerTimestampRef.current) {
      winnerTimestampRef.current = Date.now();
    }

    if (winner && winnerTimestampRef.current && !replayMode) {
      const elapsed = Date.now() - winnerTimestampRef.current;
      const timeUntilReplay = 15000 - elapsed;

      if (timeUntilReplay <= 0) {
        // Start replay immediately
        const timeline = buildReplayTimeline(party.event.entries);
        setReplayTimeline(timeline);
        setReplayIndex(0);
        setReplayState({ inRing: new Set(), eliminated: [] });
        setReplayMode(true);
      } else {
        // Schedule replay start
        const timeout = setTimeout(() => {
          const timeline = buildReplayTimeline(party.event.entries);
          setReplayTimeline(timeline);
          setReplayIndex(0);
          setReplayState({ inRing: new Set(), eliminated: [] });
          setReplayMode(true);
        }, timeUntilReplay);

        return () => clearTimeout(timeout);
      }
    }
  }, [party, replayMode, buildReplayTimeline]);

  // Process replay events
  useEffect(() => {
    if (!replayMode || replayTimeline.length === 0) return;

    const processNextEvent = () => {
      if (replayIndex >= replayTimeline.length) {
        // Replay complete, restart after 5 seconds
        replayTimeoutRef.current = setTimeout(() => {
          setReplayIndex(0);
          setReplayState({ inRing: new Set(), eliminated: [] });
        }, 5000);
        return;
      }

      const event = replayTimeline[replayIndex];
      const delay = event.type === "entry" ? 1000 : event.type === "elimination" ? 2000 : 3000;

      // Show announcement
      if (event.type === "entry" && event.entry.wrestlerName) {
        showEntryAnnouncement({
          wrestlerName: event.entry.wrestlerName,
          entryNumber: event.entry.entryNumber,
        });
        setReplayState((prev) => ({
          ...prev,
          inRing: new Set(prev.inRing).add(event.entry.id),
        }));
      } else if (event.type === "elimination" && event.entry.wrestlerName && event.entry.eliminatedBy) {
        showEliminationAnnouncement({
          wrestlerName: event.entry.wrestlerName,
          eliminatedBy: event.entry.eliminatedBy,
          entryNumber: event.entry.entryNumber,
        });
        setReplayState((prev) => {
          const newInRing = new Set(prev.inRing);
          newInRing.delete(event.entry.id);
          return {
            inRing: newInRing,
            eliminated: [...prev.eliminated, event.entry.id],
          };
        });
      } else if (event.type === "winner" && event.entry.wrestlerName) {
        showWinnerAnnouncement(event.entry.wrestlerName, event.entry.entryNumber);
      }

      // Schedule next event
      replayTimeoutRef.current = setTimeout(() => {
        setReplayIndex((prev) => prev + 1);
      }, delay);
    };

    processNextEvent();

    return () => {
      if (replayTimeoutRef.current) {
        clearTimeout(replayTimeoutRef.current);
      }
    };
  }, [replayMode, replayIndex, replayTimeline]);

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

  // In replay mode, use replay state; otherwise use live data
  const activeWrestlers = replayMode
    ? entries
        .filter((e) => replayState.inRing.has(e.id))
        .sort((a, b) => a.entryNumber - b.entryNumber)
    : entries
        .filter((e) => e.wrestlerName && !e.isWinner && (!e.eliminatedAt || animatingOut.has(e.id)))
        .sort((a, b) => a.entryNumber - b.entryNumber);

  const recentEliminations = replayMode
    ? entries
        .filter((e) => replayState.eliminated.includes(e.id))
        .sort((a, b) => {
          const aIdx = replayState.eliminated.indexOf(a.id);
          const bIdx = replayState.eliminated.indexOf(b.id);
          return bIdx - aIdx; // Most recent first
        })
        .slice(0, 5)
    : entries
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

  // Dynamic grid sizing based on wrestler count
  const getGridConfig = (count: number) => {
    if (count <= 4) return { cols: "grid-cols-2", size: "large" };
    if (count <= 9) return { cols: "grid-cols-3", size: "medium" };
    if (count <= 16) return { cols: "grid-cols-4", size: "small" };
    if (count <= 25) return { cols: "grid-cols-5", size: "xs" };
    return { cols: "grid-cols-6", size: "xxs" };
  };

  const gridConfig = getGridConfig(activeWrestlers.length);

  const getCardSizeClasses = (size: string) => {
    switch (size) {
      case "large":
        return "p-3";
      case "medium":
        return "p-2.5";
      case "small":
        return "p-2";
      case "xs":
        return "p-1.5";
      case "xxs":
        return "p-1";
      default:
        return "p-3";
    }
  };

  const getTextSizeClasses = (size: string) => {
    switch (size) {
      case "large":
        return { number: "text-xl", name: "text-base", participant: "text-sm" };
      case "medium":
        return { number: "text-lg", name: "text-sm", participant: "text-xs" };
      case "small":
        return { number: "text-base", name: "text-xs", participant: "text-xs" };
      case "xs":
        return { number: "text-sm", name: "text-xs", participant: "text-xs" };
      case "xxs":
        return { number: "text-xs", name: "text-xs", participant: "hidden" };
      default:
        return { number: "text-xl", name: "text-base", participant: "text-sm" };
    }
  };

  const textSizes = getTextSizeClasses(gridConfig.size);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6 overflow-hidden">
      <Toaster position="top-center" expand={true} richColors />
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-2">{party.event.name}</h1>
        <p className="text-xl text-purple-300">{party.name}</p>
      </div>

      {/* Winner Celebration */}
      {winner && !replayMode && (
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

            {/* Replay countdown */}
            <p className="text-gray-400 text-sm mt-8">Replay starting soon...</p>
          </div>
        </div>
      )}

      {/* Replay Mode Indicator */}
      {replayMode && (
        <>
          {/* Replay badge in header */}
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
            <Badge className="bg-blue-600 text-white text-lg px-4 py-2 animate-pulse">
              REPLAY
            </Badge>
          </div>
          {/* Progress bar at bottom */}
          <div className="fixed bottom-0 left-0 right-0 h-2 bg-gray-800 z-50">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{
                width: `${replayTimeline.length > 0 ? (replayIndex / replayTimeline.length) * 100 : 0}%`,
              }}
            />
          </div>
        </>
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
            <div className="bg-black/30 rounded-xl p-4 flex-1 overflow-hidden flex flex-col">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                IN THE RING
                <Badge className="bg-green-500">{activeWrestlers.length}</Badge>
              </h2>
              <div className={`grid ${gridConfig.cols} gap-2 flex-1 content-start`}>
                {activeWrestlers.map((entry) => {
                  const isAnimatingOut = animatingOut.has(entry.id);
                  return (
                    <div
                      key={entry.id}
                      className={`rounded-lg ${getCardSizeClasses(gridConfig.size)} ${
                        isAnimatingOut
                          ? "bg-red-500/40 border border-red-500 animate-[fallToRight_0.6s_ease-in_forwards]"
                          : "bg-green-500/20 border border-green-500 animate-[fadeIn_0.3s_ease-out]"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className={`${textSizes.number} font-bold ${isAnimatingOut ? "text-red-400" : "text-green-400"}`}>#{entry.entryNumber}</span>
                        <span className={`text-white font-medium truncate ${textSizes.name}`}>{entry.wrestlerName}</span>
                      </div>
                      <p className={`${isAnimatingOut ? "text-red-300" : "text-green-300"} ${textSizes.participant}`}>{getParticipantForEntry(entry.entryNumber)}</p>
                    </div>
                  );
                })}
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

                  if (replayMode && entry) {
                    // Replay mode coloring
                    const isInRing = replayState.inRing.has(entry.id);
                    const isEliminated = replayState.eliminated.includes(entry.id);
                    if (isInRing) {
                      bgColor = "bg-green-500";
                      textColor = "text-white";
                    } else if (isEliminated) {
                      bgColor = "bg-red-600/50";
                      textColor = "text-red-300";
                    }
                  } else if (entry) {
                    // Live mode coloring
                    if (entry.isWinner) {
                      bgColor = "bg-yellow-500";
                      textColor = "text-black";
                    } else if (entry.eliminatedAt) {
                      bgColor = "bg-red-600/50";
                      textColor = "text-red-300";
                    } else if (entry.wrestlerName) {
                      bgColor = "bg-green-500";
                      textColor = "text-white";
                    }
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
                {replayMode ? replayState.eliminated.length : entries.filter((e) => e.eliminatedAt).length}
              </Badge>
              <span className="text-xs text-gray-500 font-normal ml-auto">(newest first)</span>
            </h2>
            <div className="space-y-3 overflow-y-auto max-h-[calc(100%-3rem)]">
              {recentEliminations.length === 0 ? (
                <p className="text-gray-500">No eliminations yet</p>
              ) : (
                recentEliminations.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`bg-red-500/20 border rounded-lg p-3 ${
                      index === 0
                        ? "border-red-400 ring-2 ring-red-400 animate-[pulseGlow_2s_ease-in-out_infinite]"
                        : "border-red-500/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold text-red-400">#{entry.entryNumber}</span>
                      <span className="text-white font-medium">{entry.wrestlerName}</span>
                      {index === 0 && (
                        <Badge className="bg-red-600 text-white text-xs ml-auto animate-pulse">
                          LATEST
                        </Badge>
                      )}
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
