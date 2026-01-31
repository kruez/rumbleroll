"use client";

import { useEffect, useState, use, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Header } from "@/components/Header";
import { UserAvatar } from "@/components/UserAvatar";
import { ScoreboardDropdown } from "@/components/ScoreboardDropdown";
import { QRCodeSVG } from "qrcode.react";

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
  hasPaid: boolean;
  paidAt: string | null;
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
  entryFee: number | null;
  hostId: string;
  host: { id: string; name: string | null; email: string; venmoHandle: string | null; cashAppHandle: string | null };
  event: RumbleEvent;
  participants: Participant[];
  isHost: boolean;
}

export default function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [showStartMessage, setShowStartMessage] = useState(false);
  const [confirmDistributeOpen, setConfirmDistributeOpen] = useState(false);
  const prevStatus = useRef<Party["status"] | undefined>(undefined);

  const fetchParty = useCallback(async () => {
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
  }, [id]);

  useEffect(() => {
    fetchParty();
    const interval = setInterval(fetchParty, 5000);
    return () => clearInterval(interval);
  }, [fetchParty]);

  // Detect transition from LOBBY to NUMBERS_ASSIGNED to show celebration message
  useEffect(() => {
    if (prevStatus.current === "LOBBY" && party?.status === "NUMBERS_ASSIGNED") {
      setShowStartMessage(true);
      const timer = setTimeout(() => setShowStartMessage(false), 3000);
      return () => clearTimeout(timer);
    }
    prevStatus.current = party?.status;
  }, [party?.status]);

  const handleLeave = async () => {
    setLeaving(true);
    try {
      const res = await fetch(`/api/parties/${id}/leave`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to leave party");
        return;
      }
      toast.success("You have left the party");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to leave party");
    } finally {
      setLeaving(false);
    }
  };

  const handleStartParty = () => {
    // Check if we need confirmation for unpaid participants
    if (party?.entryFee && party.entryFee > 0) {
      const unpaidCount = party.participants.filter(p => !p.hasPaid).length;
      if (unpaidCount > 0) {
        setConfirmDistributeOpen(true);
        return;
      }
    }
    handleDistribute();
  };

  const handleDistribute = async () => {
    setConfirmDistributeOpen(false);
    setDistributing(true);
    try {
      const res = await fetch(`/api/parties/${id}/distribute`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to start party");
        return;
      }
      toast.success("Numbers distributed! The party has started!");
      fetchParty();
    } catch {
      toast.error("Failed to start party");
    } finally {
      setDistributing(false);
    }
  };

  const handleCopySpectatorLink = () => {
    if (!party) return;
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const spectatorUrl = `${baseUrl}/party/${party.id}/spectate?code=${party.inviteCode}`;
    navigator.clipboard.writeText(spectatorUrl);
    toast.success("Spectator link copied!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (error || !party) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
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
  const myAssignments = myParticipant?.assignments || [];
  const isParticipant = !!myParticipant;

  // Get entry data for each assignment
  const myNumbers = myAssignments.map(a => {
    const entry = party.event.entries.find(e => e.entryNumber === a.entryNumber);
    return { ...a, entry };
  });

  const getEntryStatus = (entry: Entry | undefined) => {
    if (!entry?.wrestlerName) {
      return { status: "waiting", label: "Not yet entered", color: "bg-gray-600" };
    }
    if (entry.isWinner) {
      return { status: "winner", label: "WINNER!", color: "bg-yellow-500" };
    }
    if (entry.eliminatedAt) {
      return { status: "eliminated", label: `Eliminated by ${entry.eliminatedBy}`, color: "bg-red-500" };
    }
    return { status: "active", label: "In the Ring!", color: "bg-green-500" };
  };

  // Calculate stats from event entries
  const entries = party.event.entries;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Header />

      {/* Party Header */}
      <div className="border-b border-gray-700 bg-gray-900/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm">
                &larr; Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-white">{party.name}</h1>
              <p className="text-gray-400">{party.event.name}</p>
            </div>
            <div className="flex items-center gap-4">
              {party.isHost && party.status === "LOBBY" && (
                <Link href={`/party/${party.id}/admin`}>
                  <Button variant="outline" className="bg-transparent border-purple-500 text-purple-500 hover:bg-purple-500/10">
                    Manage Party
                  </Button>
                </Link>
              )}
              {party.isHost && party.status !== "LOBBY" && (
                <Link href={`/party/${party.id}/admin`}>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    Host Controls
                  </Button>
                </Link>
              )}
              <ScoreboardDropdown partyId={party.id} />
              {party.status === "COMPLETED" && (
                <Link href={`/party/${party.id}/results`}>
                  <Button variant="outline" className="bg-transparent border-yellow-500 text-yellow-500 hover:bg-yellow-500/10">
                    View Results
                  </Button>
                </Link>
              )}
              {!party.isHost && party.status === "LOBBY" && (
                <Button
                  variant="outline"
                  onClick={handleLeave}
                  disabled={leaving}
                  className="bg-transparent border-red-500 text-red-500 hover:bg-red-500/10"
                >
                  {leaving ? "Leaving..." : "Leave Party"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* My Numbers */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">
                  {party.status === "LOBBY" ? `Welcome to ${party.name}` : "Your Numbers"}
                </CardTitle>
                {party.status !== "LOBBY" && (
                <CardDescription className="text-gray-400">
                  {!isParticipant
                    ? "You're hosting but not participating in this party"
                    : myNumbers.length > 0
                    ? `You have ${myNumbers.length} entry number${myNumbers.length !== 1 ? "s" : ""}`
                    : "No numbers assigned"}
                </CardDescription>
              )}
              </CardHeader>
              <CardContent>
                {!isParticipant ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-2">You opted out of participating when creating this party.</p>
                    <p className="text-gray-500 text-sm">You can still manage the party and track progress.</p>
                  </div>
                ) : showStartMessage ? (
                  <div className="text-center py-12">
                    <p className="text-4xl font-black text-yellow-400 animate-pulse">
                      LET&apos;S GET READY TO RUMBLE!
                    </p>
                  </div>
                ) : party.status === "LOBBY" ? (
                  <div className="text-center py-8">
                    {party.isHost ? (
                      <>
                        <p className="text-gray-400 mb-2">{party.participants.length} participant{party.participants.length !== 1 ? "s" : ""} have joined</p>
                        {party.entryFee && party.entryFee > 0 && (
                          <p className="text-green-400 text-sm mb-2">
                            {party.participants.filter(p => p.hasPaid).length}/{party.participants.length} paid
                          </p>
                        )}
                        <Button
                          onClick={handleStartParty}
                          disabled={distributing || party.participants.length === 0}
                          className="bg-green-600 hover:bg-green-700 mt-4"
                          size="lg"
                        >
                          {distributing ? "Starting..." : "Start Party"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-400 mb-2">Waiting for host to start the game...</p>
                        <p className="text-gray-500 text-sm">{party.participants.length} participant{party.participants.length !== 1 ? "s" : ""} have joined</p>
                        {/* Payment reminder for participants */}
                        {party.entryFee && party.entryFee > 0 && myParticipant && !myParticipant.hasPaid && (
                          <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/50">
                            <p className="text-yellow-400 text-sm font-medium">Payment Required</p>
                            <p className="text-gray-400 text-xs">Pay ${party.entryFee.toFixed(2)} to the host to receive your numbers</p>
                          </div>
                        )}
                        {party.entryFee && party.entryFee > 0 && myParticipant?.hasPaid && (
                          <div className="mt-4">
                            <Badge className="bg-green-500">Payment Confirmed</Badge>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : myNumbers.length === 0 ? (
                  <p className="text-gray-400">You don&apos;t have any numbers assigned.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {myNumbers
                      .sort((a, b) => a.entryNumber - b.entryNumber)
                      .map((assignment) => {
                        const entryStatus = getEntryStatus(assignment.entry);
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
            {/* Entry Fee Info */}
            {party.entryFee && (
              <Card className="bg-gradient-to-br from-green-900/50 to-gray-800/50 border-green-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Entry Fee</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-4">
                    <span className="text-3xl font-bold text-green-400">${party.entryFee.toFixed(2)}</span>
                  </div>
                  {(party.host.venmoHandle || party.host.cashAppHandle) && (
                    <div className="space-y-2">
                      <p className="text-gray-400 text-sm text-center mb-2">Pay the host:</p>
                      {party.host.venmoHandle && (
                        <div className="flex items-center justify-center gap-2 p-2 bg-gray-900/50 rounded">
                          <span className="text-blue-400 font-medium">Venmo:</span>
                          <span className="text-white">{party.host.venmoHandle}</span>
                        </div>
                      )}
                      {party.host.cashAppHandle && (
                        <div className="flex items-center justify-center gap-2 p-2 bg-gray-900/50 rounded">
                          <span className="text-green-400 font-medium">Cash App:</span>
                          <span className="text-white">{party.host.cashAppHandle}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {!party.host.venmoHandle && !party.host.cashAppHandle && (
                    <p className="text-gray-400 text-sm text-center">
                      Contact {party.host.name || party.host.email} to pay
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

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
                {party.status === "LOBBY" && (
                  <div className="flex justify-center mt-4">
                    <div className="bg-white p-2 rounded-lg">
                      <QRCodeSVG
                        value={`${typeof window !== "undefined" ? window.location.origin : ""}/join?code=${party.inviteCode}`}
                        size={120}
                        level="M"
                      />
                    </div>
                  </div>
                )}
                <p className="text-gray-400 text-sm mt-4 text-center">
                  {party.status === "LOBBY"
                    ? "Share this code or scan the QR to join"
                    : "Share this code with friends to let them join"}
                </p>
                {/* Spectator link button */}
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopySpectatorLink}
                    className="w-full bg-transparent border-purple-500 text-purple-400 hover:bg-purple-500/10"
                  >
                    Copy Spectator Link
                  </Button>
                  <p className="text-gray-500 text-xs mt-2 text-center">
                    Share with people who want to watch without joining
                  </p>
                </div>
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
                    const participantEntries = participant.assignments.map(a =>
                      entries.find(e => e.entryNumber === a.entryNumber)
                    );
                    const activeCount = participantEntries.filter(
                      e => e?.wrestlerName && !e?.eliminatedAt
                    ).length;
                    const hasWinner = participantEntries.some(e => e?.isWinner);

                    return (
                      <div
                        key={participant.id}
                        className="flex justify-between items-center p-2 rounded bg-gray-700/30"
                      >
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            name={participant.user.name}
                            email={participant.user.email}
                            profileImageUrl={participant.user.profileImageUrl}
                            size="sm"
                          />
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
                        {entries.filter(e => e.wrestlerName).length} / 30
                      </span>
                    </div>
                    <Separator className="bg-gray-700" />
                    <div className="flex justify-between">
                      <span className="text-gray-400">Eliminated</span>
                      <span className="text-white font-bold">
                        {entries.filter(e => e.eliminatedAt).length}
                      </span>
                    </div>
                    <Separator className="bg-gray-700" />
                    <div className="flex justify-between">
                      <span className="text-gray-400">In Ring</span>
                      <span className="text-white font-bold">
                        {entries.filter(e => e.wrestlerName && !e.eliminatedAt).length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Confirmation Dialog for Starting with Unpaid Participants */}
      <Dialog open={confirmDistributeOpen} onOpenChange={setConfirmDistributeOpen}>
        <DialogContent className="bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Start with Unpaid Participants?</DialogTitle>
            <DialogDescription className="text-gray-400">
              {party && party.entryFee && (
                <>
                  {party.participants.filter(p => !p.hasPaid).length} participant{party.participants.filter(p => !p.hasPaid).length !== 1 ? "s haven't" : " hasn't"} paid the ${party.entryFee.toFixed(2)} entry fee.
                  <br /><br />
                  <strong className="text-yellow-400">They will not receive any numbers.</strong>
                  <br /><br />
                  You can go to Host Controls to mark payments as confirmed, or proceed without them.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDistributeOpen(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Go Back
            </Button>
            <Button
              onClick={handleDistribute}
              disabled={distributing}
              className="bg-green-600 hover:bg-green-700"
            >
              {distributing ? "Starting..." : "Proceed Anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
