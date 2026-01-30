"use client";

import { useEffect, useState, use, useCallback, useRef, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";

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
  wrestlerImageUrl: string | null;
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

type CelebrationNameStatus =
  | "entering"
  | "active"
  | "pending_elimination"  // Waiting for collision to trigger elimination
  | "eliminating"          // Shake/explode sequence
  | "eliminated";

type EliminationPhase = "red" | "shake" | "explode";

interface FloatingName {
  id: string;
  entryNumber: number;
  wrestlerName: string;
  duration: string;           // "2:34" format
  x: number;                  // px position
  y: number;
  vx: number;                 // velocity X (px/frame)
  vy: number;                 // velocity Y (px/frame)
  width: number;              // element width for collision
  height: number;             // element height for collision
  status: CelebrationNameStatus;
  scale: number;              // for enter animation (4.0 -> 1.0)
  opacity: number;            // for fade effect (0.3 -> 0.7)
  eliminatedBy?: string;      // Track who eliminated them
  eliminationPhase?: EliminationPhase; // Current phase of elimination animation
}

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
  const [floatingNames, setFloatingNames] = useState<FloatingName[]>([]);
  const [celebrationTimeline, setCelebrationTimeline] = useState<ReplayEvent[]>([]);
  const celebrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const winnerTimestampRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const celebrationContainerRef = useRef<HTMLDivElement>(null);
  const floatingNamesRef = useRef<FloatingName[]>([]);

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
  const getParticipantInfoForEntry = useCallback((entryNumber: number): { id: string; name: string; profileImageUrl?: string | null } | null => {
    if (!party) return null;
    for (const p of party.participants) {
      if (p.assignments.some((a) => a.entryNumber === entryNumber)) {
        return {
          id: p.id,
          name: p.user.name || p.user.email.split("@")[0],
          profileImageUrl: p.user.profileImageUrl,
        };
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

  // Collision detection between two floating names
  const checkCollision = useCallback((a: FloatingName, b: FloatingName): boolean => {
    const padding = 8; // small buffer to prevent touching
    return !(a.x + a.width + padding < b.x ||
             b.x + b.width + padding < a.x ||
             a.y + a.height + padding < b.y ||
             b.y + b.height + padding < a.y);
  }, []);

  // Resolve collision by swapping velocity components
  const resolveCollision = useCallback((a: FloatingName, b: FloatingName) => {
    // Calculate center points
    const ax = a.x + a.width / 2;
    const ay = a.y + a.height / 2;
    const bx = b.x + b.width / 2;
    const by = b.y + b.height / 2;

    // Normal vector
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    // Relative velocity
    const dvx = a.vx - b.vx;
    const dvy = a.vy - b.vy;
    const dvn = dvx * nx + dvy * ny;

    // Only resolve if approaching
    if (dvn > 0) return;

    // Swap velocity components along normal with some energy loss
    const restitution = 0.9;
    a.vx -= dvn * nx * restitution;
    a.vy -= dvn * ny * restitution;
    b.vx += dvn * nx * restitution;
    b.vy += dvn * ny * restitution;

    // Push apart to prevent sticking
    const overlap = (a.width + b.width) / 2 - dist + 20;
    if (overlap > 0) {
      a.x -= overlap * nx / 2;
      a.y -= overlap * ny / 2;
      b.x += overlap * nx / 2;
      b.y += overlap * ny / 2;
    }
  }, []);

  // Generate initial position that doesn't overlap existing names
  const generateInitialPosition = useCallback((
    containerWidth: number,
    containerHeight: number,
    elementWidth: number,
    elementHeight: number
  ): { x: number; y: number } => {
    const margin = 50;
    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = margin + Math.random() * (containerWidth - elementWidth - margin * 2);
      const y = margin + Math.random() * (containerHeight - elementHeight - margin * 2);

      // Check against existing names
      const overlaps = floatingNamesRef.current.some(name => {
        if (name.status === "eliminated") return false;
        const padding = 20;
        return !(x + elementWidth + padding < name.x ||
                 name.x + name.width + padding < x ||
                 y + elementHeight + padding < name.y ||
                 name.y + name.height + padding < y);
      });

      if (!overlaps) {
        return { x, y };
      }
    }

    // Fallback: return a random position anyway
    return {
      x: margin + Math.random() * (containerWidth - elementWidth - margin * 2),
      y: margin + Math.random() * (containerHeight - elementHeight - margin * 2),
    };
  }, []);

  // Generate random velocity - calm, slow drifting
  const generateRandomVelocity = useCallback((): { vx: number; vy: number } => {
    const speed = 0.3 + Math.random() * 0.3; // 0.3-0.6 px/frame (much slower, calm float)
    const angle = Math.random() * Math.PI * 2;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };
  }, []);

  // Helper to format duration as MM:SS
  const formatDuration = useCallback((enteredAt: string | null, eliminatedAt: string | null): string => {
    if (!enteredAt) return "0:00";
    const startTime = new Date(enteredAt).getTime();
    const endTime = eliminatedAt ? new Date(eliminatedAt).getTime() : now;
    const duration = Math.floor((endTime - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [now]);

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
    // DISABLED: Match replay is malfunctioning - showing same wrestler repeatedly
    return;

    if (!party) return;

    const winner = party.event.entries.find((e) => e.isWinner);

    if (winner && !winnerTimestampRef.current) {
      winnerTimestampRef.current = Date.now();
    }

    if (winner && winnerTimestampRef.current && !showCelebrationReplay) {
      const elapsed = Date.now() - winnerTimestampRef.current;
      const timeUntilReplay = 5000 - elapsed;

      const startReplay = () => {
        const timeline = buildReplayTimeline(party.event.entries);
        setCelebrationTimeline(timeline);
        setCelebrationReplayIndex(0);
        setFloatingNames([]);
        floatingNamesRef.current = [];
        setShowCelebrationReplay(true);
      };

      if (timeUntilReplay <= 0) {
        startReplay();
      } else {
        const timeout = setTimeout(startReplay, timeUntilReplay);
        return () => clearTimeout(timeout);
      }
    }
  }, [party, showCelebrationReplay, buildReplayTimeline]);

  // Process celebration replay events with calm, dramatic timing
  useEffect(() => {
    if (!showCelebrationReplay || celebrationTimeline.length === 0) return;

    const processNextEvent = () => {
      if (celebrationReplayIndex >= celebrationTimeline.length) {
        // Replay complete, restart after 5 seconds
        celebrationTimeoutRef.current = setTimeout(() => {
          setCelebrationReplayIndex(0);
          setFloatingNames([]);
          floatingNamesRef.current = [];
        }, 5000);
        return;
      }

      const event = celebrationTimeline[celebrationReplayIndex];
      // Calm timing: entry=3000ms, elimination=3000ms, winner=2000ms
      const delay = event.type === "entry" ? 3000 : event.type === "elimination" ? 3000 : 2000;

      if (event.type === "entry" && event.entry.wrestlerName) {
        const container = celebrationContainerRef.current;
        const containerWidth = container?.clientWidth || window.innerWidth;
        const containerHeight = container?.clientHeight || window.innerHeight;

        // Estimate element size (will be updated by measurement)
        const estimatedWidth = 250;
        const estimatedHeight = 50;

        // Calculate duration for this entry
        const entryDuration = formatDuration(event.entry.enteredAt, event.entry.eliminatedAt);

        // Start from center of screen, zooming in from far away
        const newName: FloatingName = {
          id: event.entry.id,
          entryNumber: event.entry.entryNumber,
          wrestlerName: event.entry.wrestlerName!,
          duration: entryDuration,
          x: containerWidth / 2 - estimatedWidth / 2,
          y: containerHeight / 2 - estimatedHeight / 2,
          vx: 0, // Start stationary
          vy: 0,
          width: estimatedWidth,
          height: estimatedHeight,
          status: "entering",
          scale: 4.0, // Start large (zooming in from far away)
          opacity: 0.3, // Start translucent/ghostly
        };

        // Add new floating name in "entering" state
        setFloatingNames((prev) => {
          const updated = [...prev, newName];
          floatingNamesRef.current = updated;
          return updated;
        });

        // Transition to "active" after 1.5s with zoom animation
        setTimeout(() => {
          const velocity = generateRandomVelocity();
          setFloatingNames((prev) => {
            const updated = prev.map((n) =>
              n.id === event.entry.id && n.status === "entering"
                ? { ...n, status: "active" as CelebrationNameStatus, scale: 1.0, opacity: 0.7, vx: velocity.vx, vy: velocity.vy }
                : n
            );
            floatingNamesRef.current = updated;
            return updated;
          });
        }, 1500);
      } else if (event.type === "elimination" && event.entry.wrestlerName) {
        // Mark as "pending_elimination" - wait for collision to trigger visual effect
        setFloatingNames((prev) => {
          const updated = prev.map((n) =>
            n.id === event.entry.id && n.status === "active"
              ? { ...n, status: "pending_elimination" as CelebrationNameStatus, eliminatedBy: event.entry.eliminatedBy || undefined }
              : n
          );
          floatingNamesRef.current = updated;
          return updated;
        });
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
  }, [showCelebrationReplay, celebrationReplayIndex, celebrationTimeline, generateRandomVelocity, formatDuration]);

  // Trigger elimination animation sequence with phased updates
  const triggerEliminationAnimation = useCallback((name: FloatingName) => {
    const nameId = name.id;
    name.status = "eliminating";
    name.eliminationPhase = "red";

    // Phase 1: Turn red (immediate)
    setFloatingNames((prev) => {
      const updated = prev.map((n) =>
        n.id === nameId ? { ...n, status: "eliminating" as CelebrationNameStatus, eliminationPhase: "red" as EliminationPhase } : n
      );
      floatingNamesRef.current = updated;
      return updated;
    });

    // Phase 2: Start shake (after 200ms)
    setTimeout(() => {
      setFloatingNames((prev) => {
        const updated = prev.map((n) =>
          n.id === nameId && n.status === "eliminating"
            ? { ...n, eliminationPhase: "shake" as EliminationPhase }
            : n
        );
        floatingNamesRef.current = updated;
        return updated;
      });
    }, 200);

    // Phase 3: Start explode (after 600ms)
    setTimeout(() => {
      setFloatingNames((prev) => {
        const updated = prev.map((n) =>
          n.id === nameId && n.status === "eliminating"
            ? { ...n, eliminationPhase: "explode" as EliminationPhase }
            : n
        );
        floatingNamesRef.current = updated;
        return updated;
      });
    }, 600);

    // Phase 4: Set to eliminated (after 900ms)
    setTimeout(() => {
      setFloatingNames((prev) => {
        const updated = prev.map((n) =>
          n.id === nameId ? { ...n, status: "eliminated" as CelebrationNameStatus } : n
        );
        floatingNamesRef.current = updated;
        return updated;
      });
    }, 900);
  }, []);

  // Physics animation loop for bouncing names
  useEffect(() => {
    if (!showCelebrationReplay) return;

    const updatePhysics = () => {
      const container = celebrationContainerRef.current;
      if (!container) {
        animationFrameRef.current = requestAnimationFrame(updatePhysics);
        return;
      }

      const { width, height } = container.getBoundingClientRect();

      setFloatingNames((prev) => {
        // Skip if no names to animate
        if (prev.length === 0) return prev;

        // Create mutable copies for physics updates
        const next = prev.map((name) => ({ ...name }));

        // Update positions for active and pending_elimination names
        for (const name of next) {
          if (name.status === "eliminated" || name.status === "eliminating") continue;

          // Update position
          name.x += name.vx;
          name.y += name.vy;

          // Wall bounce with margin
          const margin = 10;
          let hitWall = false;

          if (name.x < margin) {
            name.x = margin;
            name.vx = Math.abs(name.vx);
            hitWall = true;
          }
          if (name.x + name.width > width - margin) {
            name.x = width - name.width - margin;
            name.vx = -Math.abs(name.vx);
            hitWall = true;
          }
          if (name.y < margin) {
            name.y = margin;
            name.vy = Math.abs(name.vy);
            hitWall = true;
          }
          if (name.y + name.height > height - margin) {
            name.y = height - name.height - margin;
            name.vy = -Math.abs(name.vy);
            hitWall = true;
          }

          // Wall collision triggers elimination for pending_elimination
          if (hitWall && name.status === "pending_elimination") {
            triggerEliminationAnimation(name);
          }
        }

        // Element collision detection
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i];
            const b = next[j];
            if (a.status !== "eliminated" && a.status !== "eliminating" &&
                b.status !== "eliminated" && b.status !== "eliminating") {
              if (checkCollision(a, b)) {
                // Check if either is pending_elimination - trigger their elimination on collision
                const aWasPending = a.status === "pending_elimination";
                const bWasPending = b.status === "pending_elimination";

                if (aWasPending) {
                  triggerEliminationAnimation(a);
                }
                if (bWasPending) {
                  triggerEliminationAnimation(b);
                }

                // Still resolve collision physics if neither was pending elimination
                if (!aWasPending && !bWasPending) {
                  resolveCollision(a, b);
                }
              }
            }
          }
        }

        floatingNamesRef.current = next;
        return next;
      });

      animationFrameRef.current = requestAnimationFrame(updatePhysics);
    };

    animationFrameRef.current = requestAnimationFrame(updatePhysics);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [showCelebrationReplay, checkCollision, resolveCollision, triggerEliminationAnimation]);

  // Measure floating name elements after render to get accurate sizes
  useEffect(() => {
    if (!showCelebrationReplay || !celebrationContainerRef.current) return;

    const container = celebrationContainerRef.current;
    const elements = container.querySelectorAll('[data-floating-name]');

    if (elements.length === 0) return;

    setFloatingNames((prev) => {
      let updated = false;
      const next = prev.map((name) => {
        const element = container.querySelector(`[data-floating-name="${name.id}"]`);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.width !== name.width || rect.height !== name.height) {
            updated = true;
            return { ...name, width: rect.width, height: rect.height };
          }
        }
        return name;
      });
      if (updated) {
        floatingNamesRef.current = next;
        return next;
      }
      return prev;
    });
  }, [showCelebrationReplay, floatingNames.length]);

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

          {/* Full-Screen Floating Names Replay */}
          {showCelebrationReplay && (
            <div
              ref={celebrationContainerRef}
              className="absolute inset-0 pointer-events-none overflow-hidden z-20"
            >
              <style>{`
                @keyframes wrestlerShake {
                  0%, 100% { transform: translateX(0) rotate(0); }
                  10% { transform: translateX(-3px) rotate(-2deg); }
                  20% { transform: translateX(3px) rotate(2deg); }
                  30% { transform: translateX(-3px) rotate(-2deg); }
                  40% { transform: translateX(3px) rotate(2deg); }
                  50% { transform: translateX(-3px) rotate(-1deg); }
                  60% { transform: translateX(3px) rotate(1deg); }
                  70% { transform: translateX(-2px) rotate(-1deg); }
                  80% { transform: translateX(2px) rotate(1deg); }
                  90% { transform: translateX(-1px) rotate(0); }
                }
                @keyframes wrestlerExplode {
                  0% { transform: scale(1); opacity: 0.7; }
                  30% { transform: scale(1.3); opacity: 0.9; }
                  100% { transform: scale(0.1); opacity: 0; }
                }
              `}</style>
              {floatingNames.map((name) => {
                if (name.status === "eliminated") return null;

                // Find the winner to give special treatment
                const isWinner = winner?.id === name.id;
                const isEliminating = name.status === "eliminating";
                const isPendingElimination = name.status === "pending_elimination";

                // Determine styling based on elimination phase
                let animationStyle: React.CSSProperties = {};
                let textColorClass = "text-white";
                let containerAnimation = "";

                if (isEliminating && name.eliminationPhase) {
                  textColorClass = "text-red-500"; // Red throughout elimination

                  switch (name.eliminationPhase) {
                    case "red":
                      // Phase 1: Just red text, no animation yet
                      break;
                    case "shake":
                      // Phase 2: Shake animation
                      containerAnimation = "wrestlerShake 0.4s ease-in-out";
                      break;
                    case "explode":
                      // Phase 3: Explode animation
                      animationStyle = {
                        animation: "wrestlerExplode 0.3s ease-out forwards",
                      };
                      break;
                  }
                }

                // Pending elimination names slightly pulse/glow to hint they're doomed
                if (isPendingElimination) {
                  textColorClass = "text-orange-300";
                }

                return (
                  <div
                    key={name.id}
                    data-floating-name={name.id}
                    className={`absolute flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap ${
                      isWinner
                        ? "bg-yellow-500/30 border-2 border-yellow-400"
                        : "bg-black/40 backdrop-blur-sm"
                    }`}
                    style={{
                      left: `${name.x}px`,
                      top: `${name.y}px`,
                      transform: `scale(${name.scale})`,
                      opacity: name.opacity,
                      transition: name.status === "entering"
                        ? "transform 1.5s ease-out, opacity 1.5s ease-out"
                        : "none",
                      animation: containerAnimation || undefined,
                      ...animationStyle,
                    }}
                  >
                    <span
                      className={`font-bold ${isWinner ? "text-yellow-300" : isEliminating || isPendingElimination ? textColorClass : "text-yellow-400"}`}
                      style={{ fontSize: `${20 * name.scale}px` }}
                    >
                      #{name.entryNumber}
                    </span>
                    <span
                      className={`font-black ${textColorClass}`}
                      style={{ fontSize: `${28 * name.scale}px` }}
                    >
                      {name.wrestlerName}
                    </span>
                    {isWinner ? (
                      <span className="text-yellow-400 text-2xl ml-1">👑</span>
                    ) : (
                      <span
                        className="text-gray-400 ml-2"
                        style={{ fontSize: `${16 * name.scale}px` }}
                      >
                        {name.duration}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!showCelebrationReplay && (
            <p className="text-gray-400 text-sm mt-8 relative z-10">Replay starting soon...</p>
          )}
        </div>
      )}

      {party.status === "LOBBY" ? (
        // Lobby view - show invite code and QR prominently
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center mb-8">
            <p className="text-2xl text-gray-400 mb-2">Waiting for players to join...</p>
            <p className="text-lg text-purple-400">{party.participants.length} player{party.participants.length !== 1 ? "s" : ""} joined</p>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
            {/* Invite Code */}
            <div className="text-center">
              <p className="text-gray-400 text-lg mb-2">Join Code</p>
              <div className="bg-gray-800/80 border-2 border-purple-500 rounded-xl px-8 py-6">
                <span className="text-6xl md:text-7xl font-mono font-bold text-white tracking-[0.3em]">
                  {party.inviteCode}
                </span>
              </div>
            </div>

            {/* QR Code */}
            <div className="text-center">
              <p className="text-gray-400 text-lg mb-2">Scan to Join</p>
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/join?code=${party.inviteCode}`}
                  size={200}
                  level="M"
                />
              </div>
            </div>
          </div>

          {/* Player list */}
          {party.participants.length > 0 && (
            <div className="mt-12 w-full max-w-4xl">
              <div className="flex flex-wrap justify-center gap-4">
                {party.participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 bg-gray-800/50 border border-gray-600 rounded-lg px-4 py-2"
                  >
                    {p.user.profileImageUrl && (
                      <img
                        src={p.user.profileImageUrl}
                        alt=""
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <span className="text-white text-lg font-medium">
                      {p.user.name || p.user.email.split("@")[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                cardClasses = `${playerColor.bg} border ${playerColor.border}`;
              } else if (isAnimatingOut) {
                // Brief transition after skull
                cardClasses = "bg-gray-800/80 border border-gray-600";
              } else {
                // Final eliminated state - grayscale/dark to clearly distinguish from active
                cardClasses = "bg-gray-800/80 border border-gray-600";
              }
            } else if (state === "active") {
              // Full vibrant player color with prominent border
              cardClasses = `${playerColor.bg} border-2 ${playerColor.border}`;
              if (isLatestEntry) {
                animationClass = "animate-[pulseGlowGreen_2s_ease-in-out_infinite]";
              }
            } else {
              // Pending state - muted player color, semi-transparent
              cardClasses = `${playerColorMuted.bg} border-2 ${playerColorMuted.border} opacity-80`;
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

                {/* Persistent faded skull for eliminated entries - BIGGER */}
                {state === "eliminated" && !isShowingSkull && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none opacity-20">
                    <span className="text-6xl">💀</span>
                  </div>
                )}

                {/* ===== PENDING CARD ===== */}
                {state === "pending" && (
                  <div className="flex flex-col items-center justify-center h-full relative z-10">
                    {/* Shimmer overlay for UP NEXT */}
                    {num === nextUpEntryNumber && (
                      <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
                        <div
                          className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmerSweep_2s_ease-in-out_infinite]"
                        />
                      </div>
                    )}
                    <span className="text-4xl font-black text-white/90">{num}</span>
                    <div className="flex items-center gap-2 mt-1">
                      {participantInfo?.profileImageUrl && (
                        <img
                          src={participantInfo.profileImageUrl}
                          alt=""
                          className="w-7 h-7 rounded-full flex-shrink-0"
                        />
                      )}
                      <p className="text-2xl font-bold truncate text-white/80">
                        {participantInfo?.name || "Unassigned"}
                      </p>
                    </div>
                    <span className={`text-sm mt-2 font-medium ${num === nextUpEntryNumber ? "text-purple-300" : "text-gray-500"}`}>
                      {num === nextUpEntryNumber ? "UP NEXT" : "WAITING"}
                    </span>
                  </div>
                )}

                {/* ===== ACTIVE CARD ===== */}
                {state === "active" && entry && (
                  <>
                    {entry.wrestlerImageUrl && (
                      <div className="absolute inset-0 overflow-hidden rounded-lg">
                        <img
                          src={entry.wrestlerImageUrl}
                          alt=""
                          className="w-full h-full object-cover opacity-15 blur-[1px]"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      </div>
                    )}
                    <div className="flex flex-col h-full relative z-10">
                      <div className="flex items-center justify-between mb-1">
                      <span className="text-lg font-bold text-white">{num}</span>
                      <span className="text-xl font-mono font-bold bg-black/40 px-2 py-1 rounded text-white">
                        {formatDuration(entry.enteredAt, null)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      {entry.wrestlerImageUrl && (
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                          <img
                            src={entry.wrestlerImageUrl}
                            alt={entry.wrestlerName || ""}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}
                      <p className="text-2xl font-black text-white leading-tight">
                        {entry.wrestlerName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-auto">
                      {participantInfo?.profileImageUrl && (
                        <img
                          src={participantInfo.profileImageUrl}
                          alt=""
                          className="w-7 h-7 rounded-full flex-shrink-0"
                        />
                      )}
                      <p className="text-xl font-bold truncate text-white/80">
                        {participantInfo?.name}
                      </p>
                    </div>
                    </div>
                  </>
                )}

                {/* ===== ELIMINATED CARD ===== */}
                {state === "eliminated" && entry && !isShowingSkull && (
                  <>
                    {entry.wrestlerImageUrl && (
                      <div className="absolute inset-0 overflow-hidden rounded-lg">
                        <img
                          src={entry.wrestlerImageUrl}
                          alt=""
                          className="w-full h-full object-cover opacity-10 blur-[1px] grayscale"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      </div>
                    )}
                    <div className="flex flex-col h-full relative z-10">
                      <span className="inline-block bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded mb-1 self-start">
                        ELIMINATED
                      </span>
                    <div className="flex items-center gap-2">
                      {entry.wrestlerImageUrl && (
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700 flex-shrink-0 opacity-50 grayscale">
                          <img
                            src={entry.wrestlerImageUrl}
                            alt={entry.wrestlerName || ""}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}
                      <p className="text-xl font-bold text-white/80 leading-tight">
                        {entry.wrestlerName}
                      </p>
                    </div>
                    <div className="flex justify-between items-center mt-auto">
                      <div className="flex items-center gap-2 min-w-0">
                        {participantInfo?.profileImageUrl && (
                          <img
                            src={participantInfo.profileImageUrl}
                            alt=""
                            className="w-6 h-6 rounded-full flex-shrink-0 opacity-70"
                          />
                        )}
                        <span className="text-lg font-bold text-gray-300 truncate">{participantInfo?.name}</span>
                      </div>
                      <span className="font-mono text-lg font-bold text-white/70 flex-shrink-0 ml-2">
                        {formatDuration(entry.enteredAt, entry.eliminatedAt)}
                      </span>
                    </div>
                    </div>
                  </>
                )}

                {/* ===== WINNER CARD ===== */}
                {state === "winner" && entry && (
                  <>
                    {entry.wrestlerImageUrl && (
                      <div className="absolute inset-0 overflow-hidden rounded-lg">
                        <img
                          src={entry.wrestlerImageUrl}
                          alt=""
                          className="w-full h-full object-cover opacity-20 blur-[1px]"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-yellow-900/60 to-transparent" />
                      </div>
                    )}
                    <div className="flex flex-col h-full relative z-10">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg font-bold text-yellow-300">{num}</span>
                        <span className="text-yellow-400 text-2xl">👑</span>
                      </div>
                    <div className="flex items-center gap-2 flex-1">
                      {entry.wrestlerImageUrl && (
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-yellow-700/50 flex-shrink-0 ring-2 ring-yellow-400">
                          <img
                            src={entry.wrestlerImageUrl}
                            alt={entry.wrestlerName || ""}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}
                      <p className="text-2xl font-black text-white leading-tight">
                        {entry.wrestlerName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {participantInfo?.profileImageUrl && (
                        <img
                          src={participantInfo.profileImageUrl}
                          alt=""
                          className="w-6 h-6 rounded-full flex-shrink-0"
                        />
                      )}
                      <p className="text-lg font-bold text-yellow-200 truncate">
                        {participantInfo?.name}
                      </p>
                    </div>
                    </div>
                  </>
                )}

                {/* Skull animation overlay (during elimination) */}
                {isShowingSkull && entry && (
                  <>
                    {entry.wrestlerImageUrl && (
                      <div className="absolute inset-0 overflow-hidden rounded-lg">
                        <img
                          src={entry.wrestlerImageUrl}
                          alt=""
                          className="w-full h-full object-cover opacity-15 blur-[1px]"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      </div>
                    )}
                    <div className="flex flex-col h-full relative z-10">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg font-bold text-white">{num}</span>
                      </div>
                    <p className="text-xl font-bold text-white/70 leading-tight">
                      {entry.wrestlerName}
                    </p>
                    <div className="flex items-center gap-2 mt-auto">
                      {participantInfo?.profileImageUrl && (
                        <img
                          src={participantInfo.profileImageUrl}
                          alt=""
                          className="w-6 h-6 rounded-full flex-shrink-0 opacity-70"
                        />
                      )}
                      <p className="text-lg font-bold text-white/50 truncate">
                        {participantInfo?.name}
                      </p>
                    </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
