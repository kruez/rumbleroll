"use client";

import { useEffect, useState, use, useCallback, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";

const PLAYER_COLORS = [
  // Primary bright colors (10)
  { bg: "bg-blue-600/50", border: "border-blue-400", text: "text-blue-200", ring: "ring-blue-400" },
  { bg: "bg-rose-600/50", border: "border-rose-400", text: "text-rose-200", ring: "ring-rose-400" },
  { bg: "bg-emerald-600/50", border: "border-emerald-400", text: "text-emerald-200", ring: "ring-emerald-400" },
  { bg: "bg-amber-600/50", border: "border-amber-400", text: "text-amber-200", ring: "ring-amber-400" },
  { bg: "bg-violet-600/50", border: "border-violet-400", text: "text-violet-200", ring: "ring-violet-400" },
  { bg: "bg-cyan-600/50", border: "border-cyan-400", text: "text-cyan-200", ring: "ring-cyan-400" },
  { bg: "bg-orange-600/50", border: "border-orange-400", text: "text-orange-200", ring: "ring-orange-400" },
  { bg: "bg-fuchsia-600/50", border: "border-fuchsia-400", text: "text-fuchsia-200", ring: "ring-fuchsia-400" },
  { bg: "bg-teal-600/50", border: "border-teal-400", text: "text-teal-200", ring: "ring-teal-400" },
  { bg: "bg-pink-600/50", border: "border-pink-400", text: "text-pink-200", ring: "ring-pink-400" },
  // Darker variants (10)
  { bg: "bg-blue-800/50", border: "border-blue-500", text: "text-blue-300", ring: "ring-blue-500" },
  { bg: "bg-rose-800/50", border: "border-rose-500", text: "text-rose-300", ring: "ring-rose-500" },
  { bg: "bg-emerald-800/50", border: "border-emerald-500", text: "text-emerald-300", ring: "ring-emerald-500" },
  { bg: "bg-amber-800/50", border: "border-amber-500", text: "text-amber-300", ring: "ring-amber-500" },
  { bg: "bg-violet-800/50", border: "border-violet-500", text: "text-violet-300", ring: "ring-violet-500" },
  { bg: "bg-cyan-800/50", border: "border-cyan-500", text: "text-cyan-300", ring: "ring-cyan-500" },
  { bg: "bg-orange-800/50", border: "border-orange-500", text: "text-orange-300", ring: "ring-orange-500" },
  { bg: "bg-fuchsia-800/50", border: "border-fuchsia-500", text: "text-fuchsia-300", ring: "ring-fuchsia-500" },
  { bg: "bg-teal-800/50", border: "border-teal-500", text: "text-teal-300", ring: "ring-teal-500" },
  { bg: "bg-pink-800/50", border: "border-pink-500", text: "text-pink-300", ring: "ring-pink-500" },
  // Additional hues (10)
  { bg: "bg-indigo-600/50", border: "border-indigo-400", text: "text-indigo-200", ring: "ring-indigo-400" },
  { bg: "bg-lime-600/50", border: "border-lime-400", text: "text-lime-200", ring: "ring-lime-400" },
  { bg: "bg-sky-600/50", border: "border-sky-400", text: "text-sky-200", ring: "ring-sky-400" },
  { bg: "bg-red-600/50", border: "border-red-400", text: "text-red-200", ring: "ring-red-400" },
  { bg: "bg-purple-600/50", border: "border-purple-400", text: "text-purple-200", ring: "ring-purple-400" },
  { bg: "bg-green-600/50", border: "border-green-400", text: "text-green-200", ring: "ring-green-400" },
  { bg: "bg-yellow-600/50", border: "border-yellow-400", text: "text-yellow-200", ring: "ring-yellow-400" },
  { bg: "bg-slate-600/50", border: "border-slate-400", text: "text-slate-200", ring: "ring-slate-400" },
  { bg: "bg-zinc-600/50", border: "border-zinc-400", text: "text-zinc-200", ring: "ring-zinc-400" },
  { bg: "bg-stone-600/50", border: "border-stone-400", text: "text-stone-200", ring: "ring-stone-400" },
];

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

type CelebrationNameStatus = "entering" | "active" | "eliminating" | "eliminated";

export default function TVDisplayV2Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);

  // Live timer state - updates every second
  const [now, setNow] = useState(Date.now());

  // Animation states
  const [animatingOut, setAnimatingOut] = useState<Set<string>>(new Set());
  const [skullAnimatingEntries, setSkullAnimatingEntries] = useState<Set<string>>(new Set());
  const [latestEntryId, setLatestEntryId] = useState<string | null>(null);

  // Winner celebration replay state
  const [showCelebrationReplay, setShowCelebrationReplay] = useState(false);
  const [celebrationReplayIndex, setCelebrationReplayIndex] = useState(0);
  const [celebrationNames, setCelebrationNames] = useState<Map<string, CelebrationNameStatus>>(new Map());
  const [celebrationTimeline, setCelebrationTimeline] = useState<ReplayEvent[]>([]);
  const celebrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const winnerTimestampRef = useRef<number | null>(null);

  // Track previous entries for detecting changes
  const prevEntriesRef = useRef<Entry[]>([]);
  const hasAnnouncedWinnerRef = useRef(false);

  // Map participant IDs to color indices (stable across re-renders)
  const participantColorMap = useMemo(() => {
    const map = new Map<string, number>();
    party?.participants.forEach((p, idx) => {
      map.set(p.id, idx % PLAYER_COLORS.length);
    });
    return map;
  }, [party?.participants]);

  // Get participant ID for a given entry number
  const getParticipantIdForEntry = useCallback((entryNumber: number): string | null => {
    if (!party) return null;
    for (const p of party.participants) {
      if (p.assignments.some((a) => a.entryNumber === entryNumber)) {
        return p.id;
      }
    }
    return null;
  }, [party]);

  // Get participant info for a given entry number
  const getParticipantInfoForEntry = useCallback((entryNumber: number): { id: string; name: string } | null => {
    if (!party) return null;
    for (const p of party.participants) {
      if (p.assignments.some((a) => a.entryNumber === entryNumber)) {
        return { id: p.id, name: p.user.name || p.user.email.split("@")[0] };
      }
    }
    return null;
  }, [party]);

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

  // Live timer interval - update every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Detect entry/elimination changes for animations
  useEffect(() => {
    if (!party) return;

    const entries = party.event.entries;
    const prevEntries = prevEntriesRef.current;

    // Skip initial load (when prevEntries is empty)
    if (prevEntries.length > 0) {
      for (const entry of entries) {
        const prevEntry = prevEntries.find((e) => e.id === entry.id);

        // New entry (wrestler just entered)
        if (entry.wrestlerName && (!prevEntry || !prevEntry.wrestlerName)) {
          setLatestEntryId(entry.id);
        }

        // New elimination - trigger skull animation
        if (entry.eliminatedAt && (!prevEntry || !prevEntry.eliminatedAt)) {
          // Clear any entry pulse when elimination occurs
          setLatestEntryId(null);

          // Add to skull animating set
          setSkullAnimatingEntries((prev) => new Set(prev).add(entry.id));

          // After skull animation completes (1.2s total), remove from skull animation
          // and add to animating out briefly for transition
          setTimeout(() => {
            setSkullAnimatingEntries((prev) => {
              const next = new Set(prev);
              next.delete(entry.id);
              return next;
            });
            setAnimatingOut((prev) => new Set(prev).add(entry.id));

            // Remove from animating out after brief transition
            setTimeout(() => {
              setAnimatingOut((prev) => {
                const next = new Set(prev);
                next.delete(entry.id);
                return next;
              });
            }, 300);
          }, 1200);
        }

        // Winner announced
        if (entry.isWinner && (!prevEntry || !prevEntry.isWinner) && !hasAnnouncedWinnerRef.current) {
          hasAnnouncedWinnerRef.current = true;
        }
      }
    }

    // Update prev entries reference
    prevEntriesRef.current = entries;
  }, [party]);

  // Poll for updates every 3 seconds
  useEffect(() => {
    fetchParty();
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

  // Start celebration replay 5 seconds after winner is shown
  useEffect(() => {
    if (!party) return;

    const winner = party.event.entries.find((e) => e.isWinner);

    if (winner && !winnerTimestampRef.current) {
      winnerTimestampRef.current = Date.now();
    }

    if (winner && winnerTimestampRef.current && !showCelebrationReplay) {
      const elapsed = Date.now() - winnerTimestampRef.current;
      const timeUntilReplay = 5000 - elapsed;

      if (timeUntilReplay <= 0) {
        const timeline = buildReplayTimeline(party.event.entries);
        setCelebrationTimeline(timeline);
        setCelebrationReplayIndex(0);
        setCelebrationNames(new Map());
        setShowCelebrationReplay(true);
      } else {
        const timeout = setTimeout(() => {
          const timeline = buildReplayTimeline(party.event.entries);
          setCelebrationTimeline(timeline);
          setCelebrationReplayIndex(0);
          setCelebrationNames(new Map());
          setShowCelebrationReplay(true);
        }, timeUntilReplay);

        return () => clearTimeout(timeout);
      }
    }
  }, [party, showCelebrationReplay, buildReplayTimeline]);

  // Process celebration replay events
  useEffect(() => {
    if (!showCelebrationReplay || celebrationTimeline.length === 0) return;

    const processNextEvent = () => {
      if (celebrationReplayIndex >= celebrationTimeline.length) {
        // Replay complete, restart after 3 seconds
        celebrationTimeoutRef.current = setTimeout(() => {
          setCelebrationReplayIndex(0);
          setCelebrationNames(new Map());
        }, 3000);
        return;
      }

      const event = celebrationTimeline[celebrationReplayIndex];
      const delay = event.type === "entry" ? 800 : event.type === "elimination" ? 1500 : 2000;

      if (event.type === "entry" && event.entry.wrestlerName) {
        setCelebrationNames((prev) => {
          const next = new Map(prev);
          next.set(event.entry.id, "entering");
          return next;
        });
        setTimeout(() => {
          setCelebrationNames((prev) => {
            const next = new Map(prev);
            if (next.get(event.entry.id) === "entering") {
              next.set(event.entry.id, "active");
            }
            return next;
          });
        }, 500);
      } else if (event.type === "elimination" && event.entry.wrestlerName && event.entry.eliminatedBy) {
        const eliminatorEntry = celebrationTimeline.find(
          (e) => e.entry.wrestlerName === event.entry.eliminatedBy && e.type === "entry"
        );

        setCelebrationNames((prev) => {
          const next = new Map(prev);
          next.set(event.entry.id, "eliminating");
          if (eliminatorEntry) {
            const eliminatorId = eliminatorEntry.entry.id;
            const currentStatus = next.get(eliminatorId);
            if (currentStatus === "active") {
              next.set(eliminatorId, "eliminating");
              setTimeout(() => {
                setCelebrationNames((p) => {
                  const n = new Map(p);
                  if (n.get(eliminatorId) === "eliminating") {
                    n.set(eliminatorId, "active");
                  }
                  return n;
                });
              }, 600);
            }
          }
          return next;
        });

        setTimeout(() => {
          setCelebrationNames((prev) => {
            const next = new Map(prev);
            next.set(event.entry.id, "eliminated");
            return next;
          });
        }, 800);
      }

      celebrationTimeoutRef.current = setTimeout(() => {
        setCelebrationReplayIndex((prev) => prev + 1);
      }, delay);
    };

    processNextEvent();

    return () => {
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
    };
  }, [showCelebrationReplay, celebrationReplayIndex, celebrationTimeline]);

  // Helper to format duration as MM:SS
  const formatDuration = (enteredAt: string | null, eliminatedAt: string | null): string => {
    if (!enteredAt) return "0:00";
    const startTime = new Date(enteredAt).getTime();
    const endTime = eliminatedAt ? new Date(eliminatedAt).getTime() : now;
    const duration = Math.floor((endTime - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

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
  const winner = entries.find((e) => e.isWinner);

  // Find the next upcoming entry (first entry without a wrestler name)
  const nextUpEntryNumber = entries.find(e => !e.wrestlerName)?.entryNumber ?? null;

  const getParticipantForEntry = (entryNumber: number) => {
    for (const p of party.participants) {
      if (p.assignments.some((a) => a.entryNumber === entryNumber)) {
        return p.user.name || p.user.email.split("@")[0];
      }
    }
    return "Unknown";
  };

  // Determine card state for each entry
  const getCardState = (entry: Entry | undefined): "pending" | "active" | "eliminated" | "winner" => {
    if (!entry || !entry.wrestlerName) return "pending";
    if (entry.isWinner) return "winner";
    if (entry.eliminatedAt) return "eliminated";
    return "active";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-1">{party.event.name}</h1>
        <p className="text-lg text-purple-300">{party.name}</p>
      </div>

      {/* Winner Celebration Overlay */}
      {winner && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-start z-50 overflow-hidden pt-8">
          {/* Spotlight effect */}
          <div className="absolute inset-0 bg-gradient-radial from-yellow-500/30 via-transparent to-transparent animate-pulse" />

          {/* Animated sparkles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
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
            <div className="mb-4 flex justify-center">
              <svg viewBox="0 0 200 120" className="w-48 h-32 drop-shadow-[0_0_30px_rgba(234,179,8,0.8)]">
                <ellipse cx="100" cy="60" rx="85" ry="45" fill="url(#beltGold)" stroke="#B8860B" strokeWidth="3"/>
                <ellipse cx="100" cy="60" rx="65" ry="32" fill="none" stroke="#B8860B" strokeWidth="2"/>
                <ellipse cx="100" cy="60" rx="50" ry="25" fill="url(#beltInner)" stroke="#FFD700" strokeWidth="1"/>
                <circle cx="100" cy="60" r="15" fill="#DC143C" stroke="#FFD700" strokeWidth="2"/>
                <circle cx="100" cy="60" r="8" fill="#FF6B6B" opacity="0.6"/>
                <rect x="10" y="40" width="25" height="40" rx="5" fill="url(#beltGold)" stroke="#B8860B" strokeWidth="2"/>
                <rect x="165" y="40" width="25" height="40" rx="5" fill="url(#beltGold)" stroke="#B8860B" strokeWidth="2"/>
                <polygon points="50,55 52,61 58,61 53,65 55,71 50,67 45,71 47,65 42,61 48,61" fill="#FFD700"/>
                <polygon points="150,55 152,61 158,61 153,65 155,71 150,67 145,71 147,65 142,61 148,61" fill="#FFD700"/>
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

            <p className="text-yellow-400 text-2xl font-bold mb-2 tracking-widest animate-pulse">
              ROYAL RUMBLE WINNER
            </p>
            <p className="text-6xl font-black text-white mb-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] animate-[scaleIn_0.5s_ease-out]">
              {winner.wrestlerName}
            </p>
            <div className="flex items-center justify-center gap-4">
              <span className="text-3xl font-bold text-yellow-300">#{winner.entryNumber}</span>
              <span className="text-2xl text-white">-</span>
              <span className="text-2xl text-yellow-400 font-bold">{getParticipantForEntry(winner.entryNumber)}</span>
            </div>
          </div>

          {/* Visual Replay Area */}
          {showCelebrationReplay && (
            <div className="relative z-10 mt-8 w-full max-w-4xl px-8 flex-1 overflow-hidden">
              <div className="text-center mb-4">
                <Badge className="bg-blue-600/80 text-white text-sm px-3 py-1">
                  MATCH REPLAY
                </Badge>
              </div>
              <div className="relative h-64 bg-black/50 rounded-xl border border-gray-700 overflow-hidden flex flex-wrap items-center justify-center gap-3 p-4">
                {celebrationTimeline
                  .filter((e) => e.type === "entry")
                  .map((e) => {
                    const status = celebrationNames.get(e.entry.id);
                    if (!status) return null;

                    let animationClass = "";
                    if (status === "entering") {
                      animationClass = "animate-[zoomInFromFar_0.5s_ease-out_forwards]";
                    } else if (status === "active") {
                      animationClass = "opacity-30";
                    } else if (status === "eliminating") {
                      animationClass = "animate-[wrestlerHitOff_0.8s_ease-in_forwards]";
                    } else if (status === "eliminated") {
                      return null;
                    }

                    const isEliminator = celebrationTimeline.some(
                      (evt) =>
                        evt.type === "elimination" &&
                        evt.entry.eliminatedBy === e.entry.wrestlerName &&
                        celebrationNames.get(evt.entry.id) === "eliminating"
                    );

                    return (
                      <div
                        key={e.entry.id}
                        className={`px-3 py-1 text-white font-bold text-lg ${animationClass} ${
                          isEliminator ? "animate-[eliminatorStrike_0.6s_ease-in-out]" : ""
                        }`}
                      >
                        <span className="text-yellow-400 text-sm mr-1">#{e.entry.entryNumber}</span>
                        {e.entry.wrestlerName}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {!showCelebrationReplay && (
            <p className="text-gray-400 text-sm mt-8 relative z-10">Replay starting soon...</p>
          )}
        </div>
      )}

      {party.status === "LOBBY" ? (
        // Lobby view - show entry grid with player assignments but all pending
        <div className="flex-1 flex flex-col">
          <div className="text-center mb-4">
            <p className="text-xl text-gray-400">Waiting for numbers to be assigned...</p>
          </div>
          <div className="flex-1 grid grid-cols-6 gap-2 auto-rows-fr">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => {
              return (
                <div
                  key={num}
                  className="bg-gray-700/30 border border-gray-600 rounded-lg p-2 flex flex-col items-center justify-center opacity-50"
                >
                  <span className="text-3xl font-bold text-gray-400">{num}</span>
                  <span className="text-xs text-gray-500 mt-1">WAITING</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // Active game view - 6x5 grid of expanded entry cards
        <div className="flex-1 grid grid-cols-6 gap-2 auto-rows-fr">
          {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => {
            const entry = entries.find((e) => e.entryNumber === num);
            const state = getCardState(entry);
            const participantInfo = getParticipantInfoForEntry(num);
            const participantId = getParticipantIdForEntry(num);
            const playerColor = participantId ? PLAYER_COLORS[participantColorMap.get(participantId) ?? 0] : PLAYER_COLORS[0];

            const isAnimatingOut = entry ? animatingOut.has(entry.id) : false;
            const isShowingSkull = entry ? skullAnimatingEntries.has(entry.id) : false;
            const isLatestEntry = entry ? latestEntryId === entry.id : false;

            // Get a muted version of the player color for pending state (higher opacity than before)
            const playerColorMuted = participantId ? {
              bg: playerColor.bg.replace('/50', '/40'),
              border: playerColor.border,
            } : { bg: 'bg-gray-700/40', border: 'border-gray-600' };

            // Determine card styling based on state
            let cardClasses = "";
            let animationClass = "";

            if (state === "winner") {
              cardClasses = "bg-yellow-500/40 border-2 border-yellow-400 ring-2 ring-yellow-400";
            } else if (state === "eliminated") {
              if (isShowingSkull) {
                // During skull animation - keep full player color
                cardClasses = `${playerColor.bg} border ${playerColor.border} opacity-75`;
              } else if (isAnimatingOut) {
                // Brief transition after skull
                cardClasses = `${playerColor.bg} border ${playerColor.border} opacity-75`;
              } else {
                // Final eliminated state - keep full player color with slight dim
                cardClasses = `${playerColor.bg} border ${playerColor.border} opacity-75`;
              }
            } else if (state === "active") {
              cardClasses = `${playerColor.bg} border-2 ${playerColor.border}`;
              if (isLatestEntry) {
                animationClass = "animate-[pulseGlowGreen_2s_ease-in-out_infinite]";
              }
            } else {
              // Pending state - use muted player color with improved visibility
              cardClasses = `${playerColorMuted.bg} border-2 ${playerColorMuted.border} opacity-70`;
              // Add pulsating animation for the next upcoming entry
              if (num === nextUpEntryNumber) {
                animationClass = "animate-[pulseGlowExcitement_1.5s_ease-in-out_infinite]";
              }
            }

            return (
              <div
                key={num}
                className={`rounded-lg p-2 flex flex-col relative ${cardClasses} ${animationClass} transition-all duration-300`}
              >
                {/* Skull overlay for elimination animation */}
                {isShowingSkull && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <span className="text-5xl animate-[skullSpinIn_0.8s_ease-out_forwards]">
                      <span className="inline-block animate-[skullSmash_0.4s_ease-in_0.8s_forwards]">💀</span>
                    </span>
                  </div>
                )}

                {/* Persistent faded skull for eliminated entries */}
                {state === "eliminated" && !isShowingSkull && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none opacity-30">
                    <span className="text-4xl">💀</span>
                  </div>
                )}

                {/* Entry Number - always visible */}
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-2xl font-bold ${
                    state === "winner" ? "text-yellow-300" :
                    state === "eliminated" ? playerColor.text + " opacity-70" :
                    state === "active" ? playerColor.text :
                    playerColor.text + " opacity-80"
                  }`}>
                    {num}
                  </span>

                  {/* Status indicator / Timer */}
                  {state === "winner" && (
                    <span className="text-yellow-400 text-lg">👑</span>
                  )}
                  {state === "active" && entry && (
                    <span className={`text-sm font-mono ${playerColor.text} bg-black/30 px-1.5 py-0.5 rounded`}>
                      {formatDuration(entry.enteredAt, null)}
                    </span>
                  )}
                  {state === "eliminated" && entry && !isShowingSkull && (
                    <span className="text-xs font-mono text-gray-400/60 bg-black/30 px-1 py-0.5 rounded">
                      {formatDuration(entry.enteredAt, entry.eliminatedAt)}
                    </span>
                  )}
                  {state === "pending" && (
                    <span className="text-xs text-gray-500">WAITING</span>
                  )}
                </div>

                {/* Player Name - larger text */}
                <p className={`truncate ${
                  state === "winner" ? "text-base text-yellow-200" :
                  state === "eliminated" ? "text-base " + playerColor.text + " opacity-70" :
                  state === "active" ? "text-base text-white/80" :
                  "text-lg " + playerColor.text + " opacity-80"
                }`}>
                  {participantInfo?.name || "Unassigned"}
                </p>

                {/* Wrestler Name (when entered) - larger text */}
                {entry?.wrestlerName && (
                  <p className={`text-xl font-semibold truncate mt-auto ${
                    state === "winner" ? "text-white" :
                    state === "eliminated" ? "text-white/70" :
                    "text-white"
                  }`}>
                    {entry.wrestlerName}
                  </p>
                )}

                {/* Eliminated By (when eliminated) */}
                {state === "eliminated" && entry?.eliminatedBy && !isShowingSkull && (
                  <p className="text-xs text-gray-400/60 truncate">
                    by {entry.eliminatedBy}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
