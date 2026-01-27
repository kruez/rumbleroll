"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
  entry: Entry | null;
}

interface Participant {
  id: string;
  user: { id: string; name: string | null; email: string };
  assignments: Assignment[];
}

interface Party {
  id: string;
  name: string;
  eventName: string;
  inviteCode: string;
  status: "LOBBY" | "NUMBERS_ASSIGNED" | "IN_PROGRESS" | "COMPLETED";
  hostId: string;
  host: { id: string; name: string | null; email: string };
  participants: Participant[];
  entries: Entry[];
  isHost: boolean;
}

export default function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchParty();
  }, [id]);

  const fetchParty = async () => {
    try {
      const res = await fetch(`/api/parties/${id}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load party");
        return;
      }
      const data = await res.json();
      setParty(data);
    } catch {
      setError("Failed to load party");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (error || !party) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="py-8 text-center">
            <p className="text-red-400 mb-4">{error || "Party not found"}</p>
            <Link href="/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Find current user's participant record
  const myParticipant = party.participants.find(p => p.user.id === session?.user?.id);
  const myNumbers = myParticipant?.assignments || [];

  const getStatusBadge = () => {
    switch (party.status) {
      case "LOBBY":
        return <Badge className="bg-blue-500">Waiting for Players</Badge>;
      case "NUMBERS_ASSIGNED":
        return <Badge className="bg-yellow-500">Numbers Assigned</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-green-500">Match In Progress</Badge>;
      case "COMPLETED":
        return <Badge className="bg-gray-500">Completed</Badge>;
    }
  };

  const getEntryStatus = (assignment: Assignment) => {
    if (!assignment.entry?.wrestlerName) {
      return { status: "waiting", label: "Not yet entered", color: "bg-gray-600" };
    }
    if (assignment.entry.isWinner) {
      return { status: "winner", label: "WINNER!", color: "bg-yellow-500" };
    }
    if (assignment.entry.eliminatedAt) {
      return { status: "eliminated", label: `Eliminated by ${assignment.entry.eliminatedBy}`, color: "bg-red-500" };
    }
    return { status: "active", label: "In the Ring!", color: "bg-green-500" };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm">
                &larr; Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-white">{party.name}</h1>
              <p className="text-gray-400">{party.eventName}</p>
            </div>
            <div className="flex items-center gap-4">
              {getStatusBadge()}
              {party.isHost && (
                <Link href={`/party/${party.id}/admin`}>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    Host Controls
                  </Button>
                </Link>
              )}
              <Link href={`/party/${party.id}/tv`}>
                <Button variant="outline" className="border-white text-white hover:bg-white/10">
                  TV Display
                </Button>
              </Link>
              {party.status === "COMPLETED" && (
                <Link href={`/party/${party.id}/results`}>
                  <Button variant="outline" className="border-yellow-500 text-yellow-500 hover:bg-yellow-500/10">
                    View Results
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* My Numbers */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Your Numbers</CardTitle>
                <CardDescription className="text-gray-400">
                  {myNumbers.length > 0
                    ? `You have ${myNumbers.length} entry number${myNumbers.length !== 1 ? "s" : ""}`
                    : "Numbers haven't been assigned yet"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {party.status === "LOBBY" ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-2">Waiting for the host to distribute numbers...</p>
                    <p className="text-gray-500 text-sm">{party.participants.length} participant{party.participants.length !== 1 ? "s" : ""} have joined</p>
                  </div>
                ) : myNumbers.length === 0 ? (
                  <p className="text-gray-400">You don&apos;t have any numbers assigned.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {myNumbers
                      .sort((a, b) => a.entryNumber - b.entryNumber)
                      .map((assignment) => {
                        const entryStatus = getEntryStatus(assignment);
                        return (
                          <div
                            key={assignment.id}
                            className={`p-4 rounded-lg border ${
                              entryStatus.status === "winner"
                                ? "border-yellow-500 bg-yellow-500/20"
                                : entryStatus.status === "eliminated"
                                ? "border-red-500/50 bg-red-500/10"
                                : entryStatus.status === "active"
                                ? "border-green-500 bg-green-500/20"
                                : "border-gray-600 bg-gray-700/50"
                            }`}
                          >
                            <div className="text-center">
                              <div className="text-3xl font-bold text-white mb-2">
                                #{assignment.entryNumber}
                              </div>
                              {assignment.entry?.wrestlerName ? (
                                <>
                                  <div className="text-white font-medium truncate">
                                    {assignment.entry.wrestlerName}
                                  </div>
                                  <Badge className={`mt-2 ${entryStatus.color}`}>
                                    {entryStatus.status === "winner" ? "WINNER!" : entryStatus.status === "active" ? "Active" : "Eliminated"}
                                  </Badge>
                                </>
                              ) : (
                                <div className="text-gray-500 text-sm">Not entered yet</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Party Info Sidebar */}
          <div className="space-y-6">
            {/* Invite Code */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Invite Friends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-4 bg-gray-900/50 rounded-lg">
                  <span className="text-xs text-gray-500 block mb-1">Invite Code</span>
                  <span className="text-2xl font-mono text-white tracking-widest">{party.inviteCode}</span>
                </div>
                <p className="text-gray-400 text-sm mt-4 text-center">
                  Share this code with friends to let them join
                </p>
              </CardContent>
            </Card>

            {/* Participants */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Participants ({party.participants.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {party.participants.map((participant) => {
                    const activeCount = participant.assignments.filter(
                      a => a.entry?.wrestlerName && !a.entry?.eliminatedAt
                    ).length;
                    const hasWinner = participant.assignments.some(a => a.entry?.isWinner);

                    return (
                      <div
                        key={participant.id}
                        className="flex justify-between items-center p-2 rounded bg-gray-700/30"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-white">{participant.user.name || participant.user.email}</span>
                          {participant.user.id === party.hostId && (
                            <Badge variant="outline" className="text-yellow-500 border-yellow-500 text-xs">Host</Badge>
                          )}
                        </div>
                        {party.status !== "LOBBY" && (
                          <div className="text-sm">
                            {hasWinner ? (
                              <Badge className="bg-yellow-500">Winner!</Badge>
                            ) : (
                              <span className="text-gray-400">
                                {activeCount} active
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            {party.status !== "LOBBY" && (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Match Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Entered</span>
                      <span className="text-white font-bold">
                        {party.entries.filter(e => e.wrestlerName).length} / 30
                      </span>
                    </div>
                    <Separator className="bg-gray-700" />
                    <div className="flex justify-between">
                      <span className="text-gray-400">Eliminated</span>
                      <span className="text-white font-bold">
                        {party.entries.filter(e => e.eliminatedAt).length}
                      </span>
                    </div>
                    <Separator className="bg-gray-700" />
                    <div className="flex justify-between">
                      <span className="text-gray-400">In Ring</span>
                      <span className="text-white font-bold">
                        {party.entries.filter(e => e.wrestlerName && !e.eliminatedAt).length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
