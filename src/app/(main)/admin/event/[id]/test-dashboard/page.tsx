"use client";

import { useEffect, useState, use, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";

interface RumbleEntry {
  id: string;
  entryNumber: number;
  wrestlerName: string | null;
  enteredAt: string | null;
  eliminatedAt: string | null;
  eliminatedBy: string | null;
  isWinner: boolean;
}

interface RumbleEvent {
  id: string;
  name: string;
  year: number;
  isTest: boolean;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  entries: RumbleEntry[];
  _count: { parties: number };
}

interface Party {
  id: string;
  name: string;
  inviteCode: string;
  status: "LOBBY" | "NUMBERS_ASSIGNED" | "COMPLETED";
  participants: { id: string }[];
}

interface ActivityLog {
  id: string;
  message: string;
  timestamp: Date;
  type: "entry" | "elimination" | "winner" | "system";
}

type SimulationMode = "auto" | "manual" | "overlapping";

const overlappingSimConfig = {
  minWrestlersBeforeEliminations: 5,
  eliminationChancePerTick: 0.4,
  tickInterval: 800,
  maxActiveWrestlers: 12,
};

export default function TestDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const partyId = searchParams.get("partyId");
  const { data: session, status } = useSession();
  const router = useRouter();
  const [event, setEvent] = useState<RumbleEvent | null>(null);
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [simulationMode, setSimulationMode] = useState<SimulationMode>("auto");
  const stopSimulationRef = useRef(false);

  const addActivityLog = useCallback(
    (message: string, type: ActivityLog["type"]) => {
      setActivityLog((prev) => [
        {
          id: crypto.randomUUID(),
          message,
          timestamp: new Date(),
          type,
        },
        ...prev.slice(0, 49), // Keep last 50 items
      ]);
    },
    []
  );

  const fetchData = useCallback(async () => {
    try {
      const eventRes = await fetch(`/api/admin/events/${id}`);
      if (eventRes.ok) {
        const eventData = await eventRes.json();
        setEvent(eventData);
      } else {
        router.push("/admin");
        return;
      }

      if (partyId) {
        const partyRes = await fetch(`/api/parties/${partyId}`);
        if (partyRes.ok) {
          const partyData = await partyRes.json();
          setParty(partyData);
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, [id, partyId, router]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user?.isAdmin) {
      router.push("/dashboard");
      return;
    }
    fetchData();

    // Poll for updates every 2 seconds
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [session, status, router, fetchData]);

  const handleTestAction = async (
    action: "enter" | "fill" | "eliminate" | "reset"
  ): Promise<{
    success?: boolean;
    winner?: string;
    eliminated?: string;
    eliminatedBy?: string;
    wrestlerName?: string;
    entryNumber?: number;
    message?: string;
    complete?: boolean;
  } | null> => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (res.ok) {
        if (action === "enter" && data.wrestlerName) {
          addActivityLog(
            `${data.wrestlerName} entered at #${data.entryNumber}`,
            "entry"
          );
        } else if (action === "fill") {
          addActivityLog("All wrestlers auto-filled", "system");
        } else if (action === "eliminate" && data.eliminated) {
          if (data.winner) {
            addActivityLog(`${data.winner} wins the Royal Rumble!`, "winner");
          } else {
            addActivityLog(
              `${data.eliminated} eliminated by ${data.eliminatedBy}`,
              "elimination"
            );
          }
        } else if (action === "reset") {
          addActivityLog("Event and entries reset", "system");
          setActivityLog([]);
        }
        fetchData();
        return data;
      }
      return null;
    } catch (error) {
      console.error("Test mode action failed:", error);
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartEvent = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      if (res.ok) {
        addActivityLog("Event started!", "system");
        fetchData();
      }
    } catch (error) {
      console.error("Failed to start event:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const runFullAutoSimulation = async () => {
    setSimulationRunning(true);
    stopSimulationRef.current = false;
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    // Phase 1: Enter wrestlers one by one (0.5s delay)
    let allEntered = false;
    while (!allEntered && !stopSimulationRef.current) {
      const result = await handleTestAction("enter");
      if (!result?.success || result?.complete) {
        allEntered = true;
      }
      await delay(500);
    }

    // Phase 2: Eliminations (1.5s delay)
    let hasWinner = false;
    while (!hasWinner && !stopSimulationRef.current) {
      const result = await handleTestAction("eliminate");
      if (result?.winner) {
        hasWinner = true;
      } else if (!result?.success) {
        break;
      }
      await delay(1500);
    }

    setSimulationRunning(false);
    stopSimulationRef.current = false;
  };

  const stopSimulation = () => {
    stopSimulationRef.current = true;
  };

  const runOverlappingSimulation = async () => {
    setSimulationRunning(true);
    stopSimulationRef.current = false;
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    let enteredCount = event?.entries.filter((e) => e.wrestlerName).length || 0;
    let activeCount =
      event?.entries.filter(
        (e) => e.wrestlerName && !e.eliminatedAt && !e.isWinner
      ).length || 0;
    let hasWinner = false;

    while (!hasWinner && !stopSimulationRef.current) {
      const canEnter = enteredCount < 30;
      const canEliminate =
        activeCount >= overlappingSimConfig.minWrestlersBeforeEliminations;

      // Decide action: enter or eliminate
      let action: "enter" | "eliminate" | null = null;

      // Force elimination if too many wrestlers in ring
      if (activeCount >= overlappingSimConfig.maxActiveWrestlers && canEliminate) {
        action = "eliminate";
      }
      // If we can both enter and eliminate, use probability
      else if (canEnter && canEliminate) {
        action =
          Math.random() < overlappingSimConfig.eliminationChancePerTick
            ? "eliminate"
            : "enter";
      }
      // Only enter if we can't eliminate yet
      else if (canEnter) {
        action = "enter";
      }
      // Only eliminate if all wrestlers have entered
      else if (canEliminate) {
        action = "eliminate";
      }

      if (!action) break;

      const result = await handleTestAction(action);

      if (action === "enter" && result?.success) {
        enteredCount++;
        activeCount++;
      } else if (action === "eliminate") {
        if (result?.winner) {
          hasWinner = true;
        } else if (result?.success) {
          activeCount--;
        }
      }

      if (!result?.success && action === "enter" && result?.complete) {
        // All wrestlers entered, continue with eliminations only
        enteredCount = 30;
      }

      await delay(overlappingSimConfig.tickInterval);
    }

    setSimulationRunning(false);
    stopSimulationRef.current = false;
  };

  const handleResetEverything = async () => {
    setActionLoading(true);
    stopSimulationRef.current = true;
    try {
      // Reset the event
      await handleTestAction("reset");

      // Reset party status if we have a party
      if (partyId) {
        await fetch(`/api/parties/${partyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "NUMBERS_ASSIGNED" }),
        });
      }

      setActivityLog([]);
      addActivityLog("Everything reset to initial state", "system");
      fetchData();
    } catch (error) {
      console.error("Failed to reset:", error);
    } finally {
      setActionLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (!session?.user?.isAdmin || !event) {
    return null;
  }

  const enteredCount = event.entries.filter((e) => e.wrestlerName).length;
  const eliminatedCount = event.entries.filter((e) => e.eliminatedAt).length;
  const activeCount = event.entries.filter(
    (e) => e.wrestlerName && !e.eliminatedAt && !e.isWinner
  ).length;
  const winner = event.entries.find((e) => e.isWinner);

  // Calculate numbers distribution info
  const playerCount = party?.participants?.length || 0;
  const numbersPerPlayer = playerCount > 0 ? Math.floor(30 / playerCount) : 0;
  const playersWithExtra = playerCount > 0 ? 30 % playerCount : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Header />

      {/* Page Header */}
      <div className="border-b border-gray-700 bg-gray-900/30">
        <div className="container mx-auto px-4 py-4">
          <Link
            href={`/admin/event/${id}`}
            className="text-gray-400 hover:text-white text-sm"
          >
            &larr; Back to Event Admin
          </Link>
          <div className="flex justify-between items-center mt-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{event.name}</h1>
              <Badge className="bg-orange-500 text-white">Test Simulation</Badge>
            </div>
            <div className="flex gap-2">
              {party && (
                <>
                  <Button
                    variant="outline"
                    className="bg-transparent border-purple-500 text-purple-400 hover:bg-purple-500/10"
                    onClick={() =>
                      window.open(`/party/${party.id}`, "_blank")
                    }
                  >
                    Open Lobby
                  </Button>
                  <Button
                    variant="outline"
                    className="bg-transparent border-blue-500 text-blue-400 hover:bg-blue-500/10"
                    onClick={() =>
                      window.open(`/party/${party.id}/tv`, "_blank")
                    }
                  >
                    Open Scoreboard
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-4 text-center">
              <div className="text-sm text-gray-400 mb-1">Event Status</div>
              <Badge
                className={
                  event.status === "NOT_STARTED"
                    ? "bg-gray-500"
                    : event.status === "IN_PROGRESS"
                    ? "bg-green-500"
                    : "bg-blue-500"
                }
              >
                {event.status.replace("_", " ")}
              </Badge>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-4 text-center">
              <div className="text-sm text-gray-400 mb-1">Party Status</div>
              {party ? (
                <Badge
                  className={
                    party.status === "LOBBY"
                      ? "bg-gray-500"
                      : party.status === "NUMBERS_ASSIGNED"
                      ? "bg-purple-500"
                      : "bg-blue-500"
                  }
                >
                  {party.status.replace("_", " ")}
                </Badge>
              ) : (
                <span className="text-gray-500">No party</span>
              )}
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-4 text-center">
              <div className="text-sm text-gray-400 mb-1">Players</div>
              <div className="text-xl font-bold text-white">
                {playerCount}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-4 text-center">
              <div className="text-sm text-gray-400 mb-1">Numbers Each</div>
              <div className="text-xl font-bold text-green-400">
                {numbersPerPlayer}
                {playersWithExtra > 0 && (
                  <span className="text-xs text-gray-400 block">
                    (first {playersWithExtra} get {numbersPerPlayer + 1})
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Match Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-4 text-center">
              <div className="text-3xl font-bold text-white">
                {enteredCount}/30
              </div>
              <div className="text-gray-400 text-sm">Entered</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-4 text-center">
              <div className="text-3xl font-bold text-green-400">
                {activeCount}
              </div>
              <div className="text-gray-400 text-sm">In Ring</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-4 text-center">
              <div className="text-3xl font-bold text-red-400">
                {eliminatedCount}
              </div>
              <div className="text-gray-400 text-sm">Eliminated</div>
            </CardContent>
          </Card>
          <Card
            className={`border-gray-700 ${
              winner ? "bg-yellow-500/20 border-yellow-500" : "bg-gray-800/50"
            }`}
          >
            <CardContent className="py-4 text-center">
              {winner ? (
                <>
                  <div className="text-xl font-bold text-yellow-400">
                    {winner.wrestlerName}
                  </div>
                  <div className="text-gray-400 text-sm">
                    Winner (#{winner.entryNumber})
                  </div>
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold text-gray-500">-</div>
                  <div className="text-gray-400 text-sm">No Winner Yet</div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Simulation Mode Toggle */}
        <Card className="bg-gray-800/50 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span>Simulation Controls</span>
              <div className="flex bg-gray-700 rounded-lg p-1">
                <button
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    simulationMode === "auto"
                      ? "bg-purple-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                  onClick={() => setSimulationMode("auto")}
                  disabled={simulationRunning}
                >
                  Auto Mode
                </button>
                <button
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    simulationMode === "overlapping"
                      ? "bg-purple-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                  onClick={() => setSimulationMode("overlapping")}
                  disabled={simulationRunning}
                >
                  Overlapping
                </button>
                <button
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    simulationMode === "manual"
                      ? "bg-purple-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                  onClick={() => setSimulationMode("manual")}
                  disabled={simulationRunning}
                >
                  Manual Mode
                </button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {simulationMode === "auto" ? (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm">
                  Runs the full simulation automatically: wrestlers enter one-by-one (0.5s delay), then eliminations occur (1.5s delay) until a winner is declared.
                </p>
                <div className="flex gap-4">
                  {!simulationRunning ? (
                    <Button
                      onClick={runFullAutoSimulation}
                      disabled={actionLoading || winner !== undefined}
                      className="bg-orange-600 hover:bg-orange-700 h-16 text-lg flex-1"
                    >
                      Run Full Simulation
                    </Button>
                  ) : (
                    <Button
                      onClick={stopSimulation}
                      variant="destructive"
                      className="h-16 text-lg flex-1"
                    >
                      Stop Simulation
                    </Button>
                  )}
                  <Button
                    onClick={handleResetEverything}
                    disabled={actionLoading || simulationRunning}
                    variant="outline"
                    className="bg-transparent border-gray-500 text-gray-300 hover:bg-gray-700 h-16 text-lg"
                  >
                    Reset
                  </Button>
                </div>
                {simulationRunning && (
                  <div className="flex items-center justify-center gap-2 text-orange-400">
                    <div className="animate-spin h-4 w-4 border-2 border-orange-400 border-t-transparent rounded-full" />
                    <span>
                      {enteredCount < 30
                        ? `Entering wrestlers... ${enteredCount}/30`
                        : `Simulating eliminations... ${activeCount} wrestlers remaining`}
                    </span>
                  </div>
                )}
              </div>
            ) : simulationMode === "overlapping" ? (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm">
                  Realistic simulation: eliminations start after {overlappingSimConfig.minWrestlersBeforeEliminations} wrestlers enter.
                  {" "}Each tick has a {Math.round(overlappingSimConfig.eliminationChancePerTick * 100)}% chance of elimination vs entry.
                  {" "}Forces elimination when {overlappingSimConfig.maxActiveWrestlers}+ wrestlers are in the ring.
                </p>
                <div className="flex gap-4">
                  {!simulationRunning ? (
                    <Button
                      onClick={runOverlappingSimulation}
                      disabled={actionLoading || winner !== undefined}
                      className="bg-green-600 hover:bg-green-700 h-16 text-lg flex-1"
                    >
                      Run Overlapping Simulation
                    </Button>
                  ) : (
                    <Button
                      onClick={stopSimulation}
                      variant="destructive"
                      className="h-16 text-lg flex-1"
                    >
                      Stop Simulation
                    </Button>
                  )}
                  <Button
                    onClick={handleResetEverything}
                    disabled={actionLoading || simulationRunning}
                    variant="outline"
                    className="bg-transparent border-gray-500 text-gray-300 hover:bg-gray-700 h-16 text-lg"
                  >
                    Reset
                  </Button>
                </div>
                {simulationRunning && (
                  <div className="flex items-center justify-center gap-2 text-green-400">
                    <div className="animate-spin h-4 w-4 border-2 border-green-400 border-t-transparent rounded-full" />
                    <span>
                      Simulating... {enteredCount}/30 entered, {activeCount} in ring
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm">
                  Step through the simulation manually with full control over each action.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button
                    onClick={handleStartEvent}
                    disabled={
                      actionLoading ||
                      event.status !== "NOT_STARTED"
                    }
                    className="bg-green-600 hover:bg-green-700 h-16 text-lg"
                  >
                    Start Event
                  </Button>
                  <Button
                    onClick={() => handleTestAction("enter")}
                    disabled={
                      actionLoading ||
                      enteredCount >= 30 ||
                      event.status === "NOT_STARTED"
                    }
                    className="bg-purple-600 hover:bg-purple-700 h-16 text-lg"
                  >
                    Next Wrestler
                  </Button>
                  <Button
                    onClick={() => handleTestAction("eliminate")}
                    disabled={
                      actionLoading ||
                      activeCount === 0
                    }
                    variant="destructive"
                    className="h-16 text-lg"
                  >
                    Eliminate Random
                  </Button>
                  <Button
                    onClick={handleResetEverything}
                    disabled={actionLoading}
                    variant="outline"
                    className="bg-transparent border-gray-500 text-gray-300 hover:bg-gray-700 h-16 text-lg"
                  >
                    Reset Everything
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Activity Feed */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Activity Feed</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLog.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No activity yet. Start the simulation to see updates here.
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {activityLog.map((log) => (
                  <div
                    key={log.id}
                    className={`flex items-center gap-3 p-2 rounded ${
                      log.type === "winner"
                        ? "bg-yellow-500/20 border border-yellow-500"
                        : log.type === "elimination"
                        ? "bg-red-500/10 border border-red-500/30"
                        : log.type === "entry"
                        ? "bg-green-500/10 border border-green-500/30"
                        : "bg-gray-700/30 border border-gray-600"
                    }`}
                  >
                    <span className="text-gray-500 text-xs">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                    <span
                      className={
                        log.type === "winner"
                          ? "text-yellow-400 font-bold"
                          : log.type === "elimination"
                          ? "text-red-400"
                          : log.type === "entry"
                          ? "text-green-400"
                          : "text-gray-300"
                      }
                    >
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
