"use client";

import { useEffect, useState, use, useCallback, useRef, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getProxiedImageUrl } from "@/utils/imageProxy";

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

  // Entrance announcement animation state
  const [entranceQueue, setEntranceQueue] = useState<Array<{
    entry: Entry;
    participantName: string;
    participantImageUrl?: string | null;
    entryNumber: number;
  }>>([]);
  const [currentEntrance, setCurrentEntrance] = useState<{
    entry: Entry;
    participantName: string;
    participantImageUrl?: string | null;
    targetPosition: { x: number; y: number };
  } | null>(null);
  const [entrancePhase, setEntrancePhase] = useState<"showing" | "shrinking" | null>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const entranceOverlayRef = useRef<HTMLDivElement>(null);


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
          const participantInfo = getParticipantInfoForEntry(entry.entryNumber);
          // Add to entrance queue
          setEntranceQueue(prev => [...prev, {
            entry,
            participantName: participantInfo?.name || "Unknown",
            participantImageUrl: participantInfo?.profileImageUrl,
            entryNumber: entry.entryNumber,
          }]);
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
  }, [party, getParticipantInfoForEntry]);

  // Poll for updates every 3 seconds
  useEffect(() => {
    fetchParty();
    const interval = setInterval(fetchParty, 3000);
    return () => clearInterval(interval);
  }, [fetchParty]);

  // Process entrance queue - start next entrance when not currently animating
  useEffect(() => {
    if (entranceQueue.length === 0 || currentEntrance !== null) return;

    const nextEntrance = entranceQueue[0];
    const cardRef = cardRefs.current.get(nextEntrance.entryNumber);

    // Calculate target position for shrink animation
    let targetX = 0;
    let targetY = 0;

    if (cardRef && entranceOverlayRef.current) {
      const cardRect = cardRef.getBoundingClientRect();
      const overlayRect = entranceOverlayRef.current.getBoundingClientRect();

      // Calculate center of card relative to overlay center
      const cardCenterX = cardRect.left + cardRect.width / 2;
      const cardCenterY = cardRect.top + cardRect.height / 2;
      const overlayCenterX = overlayRect.left + overlayRect.width / 2;
      const overlayCenterY = overlayRect.top + overlayRect.height / 2;

      targetX = cardCenterX - overlayCenterX;
      targetY = cardCenterY - overlayCenterY;
    }

    // Remove from queue and start showing
    setEntranceQueue(prev => prev.slice(1));
    setCurrentEntrance({
      entry: nextEntrance.entry,
      participantName: nextEntrance.participantName,
      participantImageUrl: nextEntrance.participantImageUrl,
      targetPosition: { x: targetX, y: targetY },
    });
    setEntrancePhase("showing");

    // After 3 seconds, transition to shrinking phase
    const shrinkTimer = setTimeout(() => {
      setEntrancePhase("shrinking");

      // After shrink animation (800ms), clear and show card glow
      const clearTimer = setTimeout(() => {
        setLatestEntryId(nextEntrance.entry.id);
        setCurrentEntrance(null);
        setEntrancePhase(null);
      }, 800);

      return () => clearTimeout(clearTimer);
    }, 3000);

    return () => clearTimeout(shrinkTimer);
  }, [entranceQueue, currentEntrance]);

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
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 overflow-hidden">
          {/* Fireworks CSS */}
          <style>{`
            @keyframes firework {
              0% { transform: translate(0, 0) scale(1); opacity: 1; }
              100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
            }
            @keyframes fireworkBurst {
              0% { transform: scale(0); opacity: 0; }
              10% { transform: scale(1); opacity: 1; }
              100% { transform: scale(1); opacity: 0; }
            }
            .firework-particle {
              position: absolute;
              width: 8px;
              height: 8px;
              border-radius: 50%;
              animation: firework 1.5s ease-out forwards;
            }
            .firework-burst {
              position: absolute;
              animation: fireworkBurst 2s ease-out infinite;
            }
          `}</style>

          {/* Background wrestler image */}
          {winner.wrestlerImageUrl && (
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={getProxiedImageUrl(winner.wrestlerImageUrl) || ""}
                alt=""
                className="w-full h-full object-cover opacity-15 blur-sm"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/40" />
            </div>
          )}

          {/* Spotlight effect */}
          <div className="absolute inset-0 bg-gradient-radial from-yellow-500/30 via-transparent to-transparent animate-pulse" />

          {/* Fireworks bursts */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Burst 1 - Top Left */}
            <div className="firework-burst" style={{ left: '15%', top: '20%', animationDelay: '0s' }}>
              {[...Array(12)].map((_, i) => {
                const angle = (i / 12) * 360;
                const tx = Math.cos(angle * Math.PI / 180) * 120;
                const ty = Math.sin(angle * Math.PI / 180) * 120;
                return (
                  <div
                    key={i}
                    className="firework-particle bg-yellow-400"
                    style={{ '--tx': `${tx}px`, '--ty': `${ty}px`, animationDelay: `${i * 0.05}s` } as React.CSSProperties}
                  />
                );
              })}
            </div>
            {/* Burst 2 - Top Right */}
            <div className="firework-burst" style={{ right: '15%', top: '15%', animationDelay: '0.5s' }}>
              {[...Array(12)].map((_, i) => {
                const angle = (i / 12) * 360;
                const tx = Math.cos(angle * Math.PI / 180) * 100;
                const ty = Math.sin(angle * Math.PI / 180) * 100;
                return (
                  <div
                    key={i}
                    className="firework-particle bg-orange-400"
                    style={{ '--tx': `${tx}px`, '--ty': `${ty}px`, animationDelay: `${0.5 + i * 0.05}s` } as React.CSSProperties}
                  />
                );
              })}
            </div>
            {/* Burst 3 - Bottom Left */}
            <div className="firework-burst" style={{ left: '20%', bottom: '25%', animationDelay: '1s' }}>
              {[...Array(10)].map((_, i) => {
                const angle = (i / 10) * 360;
                const tx = Math.cos(angle * Math.PI / 180) * 90;
                const ty = Math.sin(angle * Math.PI / 180) * 90;
                return (
                  <div
                    key={i}
                    className="firework-particle bg-amber-300"
                    style={{ '--tx': `${tx}px`, '--ty': `${ty}px`, animationDelay: `${1 + i * 0.05}s` } as React.CSSProperties}
                  />
                );
              })}
            </div>
            {/* Burst 4 - Bottom Right */}
            <div className="firework-burst" style={{ right: '20%', bottom: '20%', animationDelay: '1.5s' }}>
              {[...Array(10)].map((_, i) => {
                const angle = (i / 10) * 360;
                const tx = Math.cos(angle * Math.PI / 180) * 110;
                const ty = Math.sin(angle * Math.PI / 180) * 110;
                return (
                  <div
                    key={i}
                    className="firework-particle bg-yellow-500"
                    style={{ '--tx': `${tx}px`, '--ty': `${ty}px`, animationDelay: `${1.5 + i * 0.05}s` } as React.CSSProperties}
                  />
                );
              })}
            </div>
          </div>

          <div className="text-center relative z-10 animate-[fadeIn_1s_ease-out]">
            {/* Championship Belt SVG - Enlarged */}
            <div className="mb-6 flex justify-center">
              <svg viewBox="0 0 200 120" className="w-64 h-44 drop-shadow-[0_0_30px_rgba(234,179,8,0.8)]">
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

            <p className="text-yellow-400 text-4xl font-bold mb-4 tracking-widest animate-pulse">
              ROYAL RUMBLE WINNER
            </p>

            {/* Wrestler image circle */}
            {winner.wrestlerImageUrl && (
              <div className="mb-4 flex justify-center">
                <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-yellow-400 shadow-[0_0_40px_rgba(234,179,8,0.6)]">
                  <img
                    src={getProxiedImageUrl(winner.wrestlerImageUrl) || ""}
                    alt={winner.wrestlerName || ""}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              </div>
            )}

            <p className="text-8xl font-black text-white mb-6 drop-shadow-[0_0_30px_rgba(255,255,255,0.5)] animate-[scaleIn_0.5s_ease-out]">
              {winner.wrestlerName}
            </p>

            <div className="flex items-center justify-center gap-6">
              <span className="text-5xl font-bold text-yellow-300">#{winner.entryNumber}</span>
              <span className="text-4xl text-white">-</span>
              <div className="flex items-center gap-3">
                {(() => {
                  const winnerParticipant = getParticipantInfoForEntry(winner.entryNumber);
                  return (
                    <>
                      {winnerParticipant?.profileImageUrl && (
                        <img
                          src={winnerParticipant.profileImageUrl}
                          alt=""
                          className="w-12 h-12 rounded-full ring-2 ring-yellow-400"
                        />
                      )}
                      <span className="text-4xl text-yellow-400 font-bold">{winnerParticipant?.name || getParticipantForEntry(winner.entryNumber)}</span>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wrestler Entrance Announcement Overlay */}
      {currentEntrance && entrancePhase && (
        <div
          ref={entranceOverlayRef}
          className={`fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden ${
            entrancePhase === "shrinking" ? "pointer-events-none" : ""
          }`}
          style={
            entrancePhase === "shrinking"
              ? {
                  animation: "entranceShrinkToCard 0.8s ease-in forwards",
                  "--target-x": `${currentEntrance.targetPosition.x}px`,
                  "--target-y": `${currentEntrance.targetPosition.y}px`,
                } as React.CSSProperties
              : { animation: "entranceZoomIn 0.5s ease-out" }
          }
        >
          {/* Dark background with radial gradient */}
          <div className="absolute inset-0 bg-gradient-radial from-purple-900/95 via-black/95 to-black/98" />

          {/* Animated spotlight pulse */}
          <div
            className="absolute inset-0 bg-gradient-radial from-yellow-500/20 via-transparent to-transparent"
            style={{ animation: "entranceSpotlightPulse 1.5s ease-in-out infinite" }}
          />

          {/* Purple/gold gradient border effect */}
          <div className="absolute inset-4 border-4 border-gradient-to-r from-purple-500 via-yellow-400 to-purple-500 rounded-3xl opacity-30" />

          {/* Content container */}
          <div className="relative z-10 flex flex-col items-center text-center px-8">
            {/* Entry number badge */}
            <div className="mb-6">
              <span className="text-6xl font-black text-yellow-400 drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]">
                #{currentEntrance.entry.entryNumber}
              </span>
            </div>

            {/* Wrestler image - large circular portrait */}
            {currentEntrance.entry.wrestlerImageUrl && (
              <div className="mb-8">
                <div className="w-48 h-48 rounded-full overflow-hidden ring-4 ring-yellow-400 shadow-[0_0_60px_rgba(234,179,8,0.6)] bg-gray-800">
                  <img
                    src={getProxiedImageUrl(currentEntrance.entry.wrestlerImageUrl) || ""}
                    alt={currentEntrance.entry.wrestlerName || ""}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              </div>
            )}

            {/* Wrestler name - large bold text */}
            <h2 className="text-7xl font-black text-white mb-6 drop-shadow-[0_0_30px_rgba(255,255,255,0.5)] tracking-tight">
              {currentEntrance.entry.wrestlerName}
            </h2>

            {/* Player section */}
            <div className="flex flex-col items-center gap-3 mb-8">
              <span className="text-2xl text-yellow-400/80 font-medium">Drafted by</span>
              <div className="flex items-center gap-4">
                {currentEntrance.participantImageUrl && (
                  <img
                    src={currentEntrance.participantImageUrl}
                    alt=""
                    className="w-16 h-16 rounded-full ring-2 ring-yellow-400/60"
                  />
                )}
                <span className="text-4xl font-bold text-yellow-300">
                  {currentEntrance.participantName}
                </span>
              </div>
            </div>

            {/* "HAS ENTERED THE RING!" text with animation */}
            <p
              className="text-3xl font-bold text-white/90 tracking-widest uppercase"
              style={{ animation: "entranceTextExpand 2s ease-in-out infinite" }}
            >
              Has Entered The Ring!
            </p>
          </div>
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
                ref={(el) => {
                  if (el) cardRefs.current.set(num, el);
                }}
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
                          src={getProxiedImageUrl(entry.wrestlerImageUrl) || ""}
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
                            src={getProxiedImageUrl(entry.wrestlerImageUrl) || ""}
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
                          src={getProxiedImageUrl(entry.wrestlerImageUrl) || ""}
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
                            src={getProxiedImageUrl(entry.wrestlerImageUrl) || ""}
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
                          src={getProxiedImageUrl(entry.wrestlerImageUrl) || ""}
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
                            src={getProxiedImageUrl(entry.wrestlerImageUrl) || ""}
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
                          src={getProxiedImageUrl(entry.wrestlerImageUrl) || ""}
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
