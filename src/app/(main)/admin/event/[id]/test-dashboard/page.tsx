"use client";

import { useEffect, useState, use, useCallback } from "react";
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
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  entries: RumbleEntry[];
  _count: { parties: number };
}

interface Party {
  id: string;
  name: string;
  inviteCode: string;
  status: "LOBBY" | "NUMBERS_ASSIGNED" | "COMPLETED";
  _count: { participants: number };
}

interface ActivityLog {
  id: string;
  message: string;
  timestamp: Date;
  type: "entry" | "elimination" | "winner" | "system";
}

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
  const [simulatingEliminations, setSimulatingEliminations] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);

  const addActivityLog = useCallback(
    (message: string, type: ActivityLog["type"]) => {
      setActivityLog((prev) => [
        {
          id: crypto.randomUUID(),
          message,
          timestamp: new Date(),
          type,
        },
        ...prev.slice(0, 19), // Keep last 20 items
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
    action: "fill" | "eliminate" | "reset"
  ): Promise<{
    success?: boolean;
    winner?: string;
    eliminated?: string;
    eliminatedBy?: string;
    message?: string;
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
        if (action === "fill") {
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

  const simulateEliminations = async () => {
    setSimulatingEliminations(true);
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    let shouldContinue = true;
    while (shouldContinue) {
      try {
        const res = await fetch(`/api/admin/events/${id}/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "eliminate" }),
        });
        const data = await res.json();

        if (data.eliminated) {
          if (data.winner) {
            addActivityLog(`${data.winner} wins the Royal Rumble!`, "winner");
            shouldContinue = false;
          } else {
            addActivityLog(
              `${data.eliminated} eliminated by ${data.eliminatedBy}`,
              "elimination"
            );
          }
        }

        if (!res.ok || data.winner) {
          shouldContinue = false;
        }

        fetchData();
        await delay(1000);
      } catch {
        shouldContinue = false;
      }
    }

    setSimulatingEliminations(false);
  };

  const handleResetEverything = async () => {
    setActionLoading(true);
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
            {party && (
              <Button
                variant="outline"
                className="bg-transparent border-blue-500 text-blue-400 hover:bg-blue-500/10"
                onClick={() =>
                  window.open(`/party/${party.id}/tv`, "_blank")
                }
              >
                Open Scoreboard
              </Button>
            )}
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
                {party?._count.participants || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-4 text-center">
              <div className="text-sm text-gray-400 mb-1">Numbers Dist.</div>
              <div className="text-xl font-bold text-green-400">30</div>
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

        {/* Action Buttons */}
        <Card className="bg-gray-800/50 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Simulation Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Button
                onClick={handleStartEvent}
                disabled={
                  actionLoading ||
                  simulatingEliminations ||
                  event.status !== "NOT_STARTED"
                }
                className="bg-green-600 hover:bg-green-700 h-16 text-lg"
              >
                Start Event
              </Button>
              <Button
                onClick={() => handleTestAction("fill")}
                disabled={
                  actionLoading ||
                  simulatingEliminations ||
                  enteredCount === 30 ||
                  event.status === "NOT_STARTED"
                }
                className="bg-purple-600 hover:bg-purple-700 h-16 text-lg"
              >
                Fill All Wrestlers
              </Button>
              <Button
                onClick={() => handleTestAction("eliminate")}
                disabled={
                  actionLoading ||
                  simulatingEliminations ||
                  activeCount === 0
                }
                variant="destructive"
                className="h-16 text-lg"
              >
                Eliminate One
              </Button>
              <Button
                onClick={simulateEliminations}
                disabled={
                  actionLoading ||
                  simulatingEliminations ||
                  activeCount < 2
                }
                className="bg-orange-600 hover:bg-orange-700 h-16 text-lg"
              >
                {simulatingEliminations
                  ? "Simulating..."
                  : "Run Full Simulation"}
              </Button>
              <Button
                onClick={handleResetEverything}
                disabled={actionLoading || simulatingEliminations}
                variant="outline"
                className="bg-transparent border-gray-500 text-gray-300 hover:bg-gray-700 h-16 text-lg"
              >
                Reset Everything
              </Button>
            </div>
            {simulatingEliminations && (
              <div className="flex items-center justify-center gap-2 mt-4 text-orange-400">
                <div className="animate-spin h-4 w-4 border-2 border-orange-400 border-t-transparent rounded-full" />
                <span>
                  Simulating eliminations... {activeCount} wrestlers remaining
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Activity Feed */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Live Activity Feed</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLog.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No activity yet. Start the simulation to see updates here.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
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
