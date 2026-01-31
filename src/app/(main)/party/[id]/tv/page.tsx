"use client";

import { useEffect, useState, use, useCallback, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { UserAvatar } from "@/components/UserAvatar";
import { Toaster } from "@/components/ui/sonner";
import { showEliminationAnnouncement } from "@/components/tv/AnnouncementToast";
import { UpNextBadge } from "@/components/tv/UpNextBadge";

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
  isShared?: boolean;
  shareGroup?: number | null;
}

interface SharedAssignment {
  entryNumber: number;
  participantIds: string[];
  shareGroup: number;
}

type DistributionMode = "EXCLUDE" | "BUY_EXTRA" | "SHARED";

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
  distributionMode: DistributionMode;
  event: RumbleEvent;
  participants: Participant[];
  unassignedNumbers: number[];
  sharedAssignments: SharedAssignment[];
}

interface ReplayEvent {
  type: "entry" | "elimination" | "winner";
  entry: Entry;
  timestamp: number;
}

type CelebrationNameStatus = "entering" | "active" | "eliminating" | "eliminated";

export default function TVDisplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [animatingOut, setAnimatingOut] = useState<Set<string>>(new Set());

  // Winner celebration replay state
  const [showCelebrationReplay, setShowCelebrationReplay] = useState(false);
  const [celebrationReplayIndex, setCelebrationReplayIndex] = useState(0);
  const [celebrationNames, setCelebrationNames] = useState<Map<string, CelebrationNameStatus>>(new Map());
  const [celebrationTimeline, setCelebrationTimeline] = useState<ReplayEvent[]>([]);
  const celebrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const winnerTimestampRef = useRef<number | null>(null);

  // Enhanced elimination card animation state
  const [cardTransitionPhase, setCardTransitionPhase] = useState<Map<string, "ejecting" | "sliding" | "pulsing">>(new Map());
  const [latestEliminationId, setLatestEliminationId] = useState<string | null>(null);

  // Most recent entry pulse state
  const [latestEntryId, setLatestEntryId] = useState<string | null>(null);

  // Player activity pulse state
  const [lastActivityParticipant, setLastActivityParticipant] = useState<{ id: string; type: "entry" | "elimination" } | null>(null);

  // Up Next badge state
  const [upNextMode, setUpNextMode] = useState<"pending" | "entered" | "hidden">("pending");
  const [displayedEntry, setDisplayedEntry] = useState<{
    entryNumber: number;
    participantName: string;
    wrestlerName?: string;
    participantId: string;
  } | null>(null);

  // Track previous entries for detecting changes
  const prevEntriesRef = useRef<Entry[]>([]);
  const hasAnnouncedWinnerRef = useRef(false);

  // Announcement queue state
  const [announcementQueue, setAnnouncementQueue] = useState<Array<{type: 'entry' | 'elimination' | 'winner', data: any}>>([]);
  const processingQueueRef = useRef(false);

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

  // Process announcement queue sequentially (elimination toasts only)
  useEffect(() => {
    if (announcementQueue.length === 0 || processingQueueRef.current) return;

    processingQueueRef.current = true;
    const [current, ...rest] = announcementQueue;

    // Entry announcements are handled by UpNextBadge, winner by overlay
    if (current.type === 'elimination') {
      showEliminationAnnouncement(current.data);
    }
    // Winner toast removed - celebration overlay handles it

    // Process next after delay (entry: skip fast, elimination: 2s, winner: skip)
    const delay = current.type === 'entry' ? 100 : current.type === 'elimination' ? 2000 : 100;
    setTimeout(() => {
      setAnnouncementQueue(rest);
      processingQueueRef.current = false;
    }, delay);
  }, [announcementQueue]);

  // Detect entry/elimination changes and queue announcements
  useEffect(() => {
    if (!party) return;

    const entries = party.event.entries;
    const prevEntries = prevEntriesRef.current;

    // Local helper to find participant ID for an entry number
    const findParticipantIdForEntry = (entryNumber: number): string | null => {
      for (const p of party.participants) {
        if (p.assignments.some((a) => a.entryNumber === entryNumber)) {
          return p.id;
        }
      }
      return null;
    };

    // Skip initial load (when prevEntries is empty)
    if (prevEntries.length > 0) {
      // Collect new announcements to queue
      const newAnnouncements: Array<{type: 'entry' | 'elimination' | 'winner', data: any}> = [];

      // Detect new entries
      for (const entry of entries) {
        const prevEntry = prevEntries.find((e) => e.id === entry.id);

        // New entry (wrestler just entered)
        if (entry.wrestlerName && (!prevEntry || !prevEntry.wrestlerName)) {
          newAnnouncements.push({
            type: 'entry',
            data: { wrestlerName: entry.wrestlerName, entryNumber: entry.entryNumber }
          });

          // Set latest entry for green pulse
          setLatestEntryId(entry.id);

          // Set player activity pulse for entry
          const participantId = findParticipantIdForEntry(entry.entryNumber);
          if (participantId) {
            setLastActivityParticipant({ id: participantId, type: "entry" });
          }
        }

        // New elimination
        if (entry.eliminatedAt && (!prevEntry || !prevEntry.eliminatedAt)) {
          if (entry.wrestlerName && entry.eliminatedBy) {
            // Clear any entry pulse when elimination occurs
            setLatestEntryId(null);

            // Update latest elimination for pulsing in eliminations column
            setLatestEliminationId(entry.id);

            // Add to animating out set with new spin eject animation
            setAnimatingOut((prev) => new Set(prev).add(entry.id));
            setCardTransitionPhase((prev) => new Map(prev).set(entry.id, "ejecting"));

            // Phase 1: Spin eject (1200ms)
            setTimeout(() => {
              setAnimatingOut((prev) => {
                const next = new Set(prev);
                next.delete(entry.id);
                return next;
              });
              // Phase 2: Slide down into column (500ms)
              setCardTransitionPhase((prev) => new Map(prev).set(entry.id, "sliding"));

              setTimeout(() => {
                // Phase 3: Pulsing until next elimination
                setCardTransitionPhase((prev) => new Map(prev).set(entry.id, "pulsing"));
              }, 500);
            }, 1200);

            // Set player activity pulse for elimination
            const participantId = findParticipantIdForEntry(entry.entryNumber);
            if (participantId) {
              setLastActivityParticipant({ id: participantId, type: "elimination" });
            }

            newAnnouncements.push({
              type: 'elimination',
              data: {
                wrestlerName: entry.wrestlerName,
                eliminatedBy: entry.eliminatedBy,
                entryNumber: entry.entryNumber,
              }
            });
          }
        }

        // Winner announced - just set the ref, overlay handles display
        if (entry.isWinner && (!prevEntry || !prevEntry.isWinner) && !hasAnnouncedWinnerRef.current) {
          hasAnnouncedWinnerRef.current = true;
          // No toast - winner overlay displays automatically
        }
      }

      // Add all new announcements to the queue
      if (newAnnouncements.length > 0) {
        setAnnouncementQueue(prev => [...prev, ...newAnnouncements]);
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

  // Helper to get participant info for entry number
  const getParticipantInfoForEntry = useCallback((entryNumber: number): { id: string; name: string } | null => {
    if (!party) return null;
    for (const p of party.participants) {
      if (p.assignments.some((a) => a.entryNumber === entryNumber)) {
        return { id: p.id, name: p.user.name || p.user.email.split("@")[0] };
      }
    }
    return null;
  }, [party]);

  // Compute next pending entry number
  const nextPendingEntry = useMemo(() => {
    if (!party) return null;
    const sorted = [...party.event.entries].sort((a, b) => a.entryNumber - b.entryNumber);
    return sorted.find(e => !e.wrestlerName) ?? null;
  }, [party]);

  // Up Next badge management
  const lastShownEntryNumberRef = useRef<number>(0);
  const enteredTimestampRef = useRef<number>(0);
  const enteredTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount only
  useEffect(() => {
    return () => {
      if (enteredTimeoutRef.current) {
        clearTimeout(enteredTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!party) return;

    const entries = party.event.entries;
    const enteredCount = entries.filter(e => e.wrestlerName).length;

    // Hide badge when all 30 entered
    if (enteredCount >= 30) {
      setUpNextMode("hidden");
      if (enteredTimeoutRef.current) {
        clearTimeout(enteredTimeoutRef.current);
        enteredTimeoutRef.current = null;
      }
      return;
    }

    // Find the highest entry number that has entered
    const highestEntered = entries
      .filter(e => e.wrestlerName)
      .sort((a, b) => b.entryNumber - a.entryNumber)[0];

    // Find next pending entry (lowest entry number without a wrestler)
    const nextPending = entries
      .filter(e => !e.wrestlerName)
      .sort((a, b) => a.entryNumber - b.entryNumber)[0];

    const now = Date.now();
    const inEnteredWindow = now - enteredTimestampRef.current < 3000;

    // Check if a new wrestler just entered (higher than what we last showed)
    if (highestEntered && highestEntered.entryNumber > lastShownEntryNumberRef.current) {
      // New entry detected - show "entered" state
      lastShownEntryNumberRef.current = highestEntered.entryNumber;
      enteredTimestampRef.current = now;

      // Clear any existing timeout
      if (enteredTimeoutRef.current) {
        clearTimeout(enteredTimeoutRef.current);
      }

      const participantInfo = getParticipantInfoForEntry(highestEntered.entryNumber);
      if (participantInfo) {
        setDisplayedEntry({
          entryNumber: highestEntered.entryNumber,
          participantName: participantInfo.name,
          wrestlerName: highestEntered.wrestlerName ?? undefined,
          participantId: participantInfo.id,
        });
        setUpNextMode("entered");

        // After 3 seconds, set mode to pending which triggers re-evaluation
        enteredTimeoutRef.current = setTimeout(() => {
          enteredTimeoutRef.current = null;
          setUpNextMode("pending");
        }, 3000);
      }
    } else if (!inEnteredWindow && nextPending) {
      // Not in "entered" window, show the next pending entry
      const info = getParticipantInfoForEntry(nextPending.entryNumber);
      if (info && displayedEntry?.entryNumber !== nextPending.entryNumber) {
        setDisplayedEntry({
          entryNumber: nextPending.entryNumber,
          participantName: info.name,
          participantId: info.id,
        });
        setUpNextMode("pending");
      }
    }
  }, [party, getParticipantInfoForEntry, upNextMode, displayedEntry?.entryNumber]);

  // Auto-trigger winner celebration when winner is detected
  useEffect(() => {
    if (!party || hasAnnouncedWinnerRef.current) return;

    const entries = party.event.entries;
    const existingWinner = entries.find(e => e.isWinner);

    // Trigger when backend has marked a winner
    if (existingWinner) {
      hasAnnouncedWinnerRef.current = true;
      // No toast - the winner overlay handles the celebration
      return;
    }

    // Also auto-detect if all 30 entered and 1 remains (frontend detection)
    const enteredCount = entries.filter(e => e.wrestlerName).length;
    const activeWrestlers = entries.filter(e => e.wrestlerName && !e.eliminatedAt && !e.isWinner);

    if (enteredCount === 30 && activeWrestlers.length === 1) {
      hasAnnouncedWinnerRef.current = true;
      // The winner overlay will show once backend marks the winner
    }
  }, [party]);

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

  // Start celebration replay 5 seconds after winner is shown (inside winner overlay)
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
        // Start celebration replay immediately
        const timeline = buildReplayTimeline(party.event.entries);
        setCelebrationTimeline(timeline);
        setCelebrationReplayIndex(0);
        setCelebrationNames(new Map());
        setShowCelebrationReplay(true);
      } else {
        // Schedule celebration replay start
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
        // Name zooms in with zoomInFromFar, stays faint
        setCelebrationNames((prev) => {
          const next = new Map(prev);
          next.set(event.entry.id, "entering");
          return next;
        });
        // After animation, set to active
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
        // Find the eliminator entry
        const eliminatorEntry = celebrationTimeline.find(
          (e) => e.entry.wrestlerName === event.entry.eliminatedBy && e.type === "entry"
        );

        // Mark eliminated wrestler as eliminating
        setCelebrationNames((prev) => {
          const next = new Map(prev);
          next.set(event.entry.id, "eliminating");
          // Pulse the eliminator
          if (eliminatorEntry) {
            const eliminatorId = eliminatorEntry.entry.id;
            const currentStatus = next.get(eliminatorId);
            if (currentStatus === "active") {
              // Temporarily mark for strike animation
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

        // After hit animation, mark as eliminated
        setTimeout(() => {
          setCelebrationNames((prev) => {
            const next = new Map(prev);
            next.set(event.entry.id, "eliminated");
            return next;
          });
        }, 800);
      }

      // Schedule next event
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
      // Eliminated players (no active, no waiting) go to bottom
      const aEliminated = a.activeCount === 0 && a.waitingCount === 0 && !a.hasWinner && a.eliminatedCount > 0;
      const bEliminated = b.activeCount === 0 && b.waitingCount === 0 && !b.hasWinner && b.eliminatedCount > 0;
      if (aEliminated && !bEliminated) return 1;
      if (!aEliminated && bEliminated) return -1;
      return b.activeCount - a.activeCount;
    });

  // Active wrestlers (exclude those animating out via spin eject)
  const activeWrestlers = entries
    .filter((e) => e.wrestlerName && !e.isWinner && (!e.eliminatedAt || animatingOut.has(e.id)))
    .sort((a, b) => a.entryNumber - b.entryNumber);

  // Recent eliminations (exclude those still in ejecting phase, only show sliding/pulsing)
  const recentEliminations = entries
    .filter((e) => e.eliminatedAt && !animatingOut.has(e.id))
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

  // Check if a number is shared and get all its owners
  const getSharedOwners = (entryNumber: number): string[] | null => {
    const sharedInfo = party.sharedAssignments.find(s => s.entryNumber === entryNumber);
    if (!sharedInfo) return null;
    return sharedInfo.participantIds.map(pid => {
      const p = party.participants.find(p => p.id === pid);
      return p?.user.name || p?.user.email.split("@")[0] || "Unknown";
    });
  };

  // Check if a number is unassigned (excluded)
  const isExcludedNumber = (entryNumber: number): boolean => {
    return party.unassignedNumbers.includes(entryNumber);
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

      {/* Up Next Badge */}
      {party.status !== "LOBBY" && !winner && displayedEntry && (
        <UpNextBadge
          mode={upNextMode}
          entryNumber={displayedEntry.entryNumber}
          participantName={displayedEntry.participantName}
          wrestlerName={displayedEntry.wrestlerName}
          playerColor={PLAYER_COLORS[participantColorMap.get(displayedEntry.participantId) ?? 0]}
        />
      )}

      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-2">{party.event.name}</h1>
        <p className="text-xl text-purple-300">{party.name}</p>
      </div>

      {/* Winner Celebration with Visual Replay */}
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

            <p className="text-yellow-400 text-2xl font-bold mb-2 tracking-widest animate-pulse">
              ROYAL RUMBLE WINNER
            </p>
            <p className="text-6xl font-black text-white mb-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] animate-[scaleIn_0.5s_ease-out]">
              {winner.wrestlerName}
            </p>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center gap-4">
                <span className="text-3xl font-bold text-yellow-300">#{winner.entryNumber}</span>
                <span className="text-2xl text-white">-</span>
                <span className="text-2xl text-yellow-400 font-bold">{getParticipantForEntry(winner.entryNumber)}</span>
              </div>
              {/* Show shared owners if this was a shared number */}
              {getSharedOwners(winner.entryNumber) && (
                <div className="text-center mt-2">
                  <p className="text-purple-300 text-lg flex items-center justify-center gap-2">
                    <span className="text-xl">&#129309;</span>
                    Shared by: {getSharedOwners(winner.entryNumber)!.join(", ")}
                  </p>
                </div>
              )}
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
                      return null; // Don't render eliminated names
                    }

                    // Check if this wrestler is doing the eliminating (pulse effect)
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
            <div className="space-y-2 overflow-y-auto max-h-[calc(100%-3rem)]">
              {standings.map((p) => {
                  const isEliminated = p.activeCount === 0 && p.waitingCount === 0 && !p.hasWinner && p.eliminatedCount > 0;
                  const hasActivityPulse = lastActivityParticipant?.id === p.id;
                  const activityType = lastActivityParticipant?.type;
                  const playerColor = PLAYER_COLORS[participantColorMap.get(p.id) ?? 0];

                  let pulseClass = "";
                  if (hasActivityPulse && activityType === "entry") {
                    pulseClass = "animate-[pulseGlowPlayerGreen_2s_ease-in-out_infinite]";
                  } else if (hasActivityPulse && activityType === "elimination") {
                    pulseClass = "animate-[pulseGlowPlayerRed_2s_ease-in-out_infinite]";
                  }

                  // Determine card styling based on state (no ejection animation)
                  let cardClasses = "";
                  if (p.hasWinner) {
                    cardClasses = "bg-yellow-500/30 border-2 border-yellow-500";
                  } else if (isEliminated) {
                    cardClasses = "bg-gray-800/30 border border-gray-600 opacity-50 transition-opacity duration-500";
                  } else if (p.activeCount > 0) {
                    cardClasses = `${playerColor.bg} border ${playerColor.border}`;
                  } else {
                    cardClasses = `${playerColor.bg} border ${playerColor.border} opacity-80`;
                  }

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 p-2 rounded-lg ${cardClasses} ${pulseClass}`}
                    >
                      {/* Skull icon only for eliminated players, no rank number */}
                      {isEliminated && <span className="text-lg">💀</span>}

                      <UserAvatar name={p.user.name} email={p.user.email} profileImageUrl={p.user.profileImageUrl} size="sm" />

                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm ${isEliminated ? "text-gray-400" : "text-white"} truncate`}>{p.displayName}</p>
                        <div className="flex gap-1 flex-wrap items-center">
                          {/* Active wrestlers with names */}
                          {p.assignments
                            .map((a) => ({ num: a.entryNumber, entry: entries.find(e => e.entryNumber === a.entryNumber) }))
                            .filter(({ entry }) => entry?.wrestlerName && !entry?.eliminatedAt && !entry?.isWinner)
                            .map(({ num, entry }) => (
                              <Badge key={num} className={`${playerColor.bg} ${playerColor.border} ${playerColor.text} text-xs px-1.5 py-0`}>
                                #{num} {entry!.wrestlerName}
                              </Badge>
                            ))}

                          {/* Pending count badge */}
                          {p.waitingCount > 0 && (
                            <Badge className="bg-gray-600/50 border-gray-500 text-gray-300 text-xs px-1.5 py-0">
                              {p.waitingCount} pending
                            </Badge>
                          )}

                          {/* Eliminated wrestlers with names */}
                          {p.assignments
                            .map((a) => ({ num: a.entryNumber, entry: entries.find(e => e.entryNumber === a.entryNumber) }))
                            .filter(({ entry }) => entry?.eliminatedAt)
                            .map(({ num, entry }) => (
                              <span key={num} className="text-gray-500 text-xs line-through px-0.5">
                                #{num} {entry?.wrestlerName}
                              </span>
                            ))}
                        </div>
                      </div>

                      {/* Winner badge only, no activeCount number */}
                      {p.hasWinner && (
                        <Badge className="bg-yellow-500 text-black font-bold text-xs shrink-0">WIN</Badge>
                      )}
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
                  const isLatestEntry = latestEntryId === entry.id;
                  const participantId = getParticipantIdForEntry(entry.entryNumber);
                  const playerColor = participantId ? PLAYER_COLORS[participantColorMap.get(participantId) ?? 0] : PLAYER_COLORS[0];

                  let animationClass = "";
                  if (isAnimatingOut) {
                    animationClass = "animate-[spinEject_1.2s_ease-in_forwards]";
                  } else if (isLatestEntry) {
                    animationClass = "animate-[pulseGlowGreen_2s_ease-in-out_infinite]";
                  } else {
                    animationClass = "animate-[fadeIn_0.3s_ease-out]";
                  }

                  return (
                    <div
                      key={entry.id}
                      className={`rounded-lg ${getCardSizeClasses(gridConfig.size)} ${animationClass} ${
                        isAnimatingOut
                          ? "bg-red-500/40 border border-red-500"
                          : isLatestEntry
                          ? `${playerColor.bg} border-2 ${playerColor.border}`
                          : `${playerColor.bg} border ${playerColor.border}`
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className={`${textSizes.number} font-bold ${isAnimatingOut ? "text-red-400" : playerColor.text}`}>#{entry.entryNumber}</span>
                        <span className={`text-white font-medium truncate ${textSizes.name}`}>{entry.wrestlerName}</span>
                      </div>
                      <p className={`${isAnimatingOut ? "text-red-300" : playerColor.text} ${textSizes.participant}`}>{getParticipantForEntry(entry.entryNumber)}</p>
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
                  const isExcluded = isExcludedNumber(num);
                  const isShared = getSharedOwners(num) !== null;
                  let bgColor = "bg-gray-700";
                  let textColor = "text-gray-400";
                  let borderStyle = "";

                  // Handle excluded numbers (not in play)
                  if (isExcluded) {
                    bgColor = "bg-gray-800";
                    textColor = "text-gray-600";
                  }
                  // Handle shared numbers (dashed border)
                  else if (isShared) {
                    borderStyle = "border-2 border-dashed border-purple-500";
                  }

                  if (entry) {
                    if (entry.isWinner) {
                      bgColor = "bg-yellow-500";
                      textColor = "text-black";
                    } else if (entry.eliminatedAt) {
                      bgColor = isShared ? "bg-red-600/30" : "bg-red-600/50";
                      textColor = "text-red-300";
                    } else if (entry.wrestlerName) {
                      bgColor = isShared ? "bg-green-500/70" : "bg-green-500";
                      textColor = "text-white";
                    }
                  }

                  return (
                    <div
                      key={num}
                      className={`${bgColor} ${textColor} ${borderStyle} rounded-lg p-2 text-center font-bold text-lg aspect-square flex items-center justify-center`}
                      title={isExcluded ? "Not in play" : isShared ? "Shared number" : undefined}
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
                recentEliminations.map((entry) => {
                  const transitionPhase = cardTransitionPhase.get(entry.id);
                  const isLatest = entry.id === latestEliminationId;

                  let animationClass = "";
                  if (transitionPhase === "sliding") {
                    animationClass = "animate-[slideDownIntoColumn_0.5s_ease-out]";
                  } else if (transitionPhase === "pulsing" && isLatest) {
                    animationClass = "animate-[pulseGlow_2s_ease-in-out_infinite]";
                  }

                  return (
                    <div
                      key={entry.id}
                      className={`bg-red-500/20 border rounded-lg p-3 ${animationClass} ${
                        isLatest
                          ? "border-red-400 ring-2 ring-red-400"
                          : "border-red-500/50"
                      }`}
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
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
