"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Header } from "@/components/Header";

interface RumbleEvent {
  id: string;
  name: string;
  year: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
}

interface Party {
  id: string;
  name: string;
  inviteCode: string;
  status: "LOBBY" | "NUMBERS_ASSIGNED" | "COMPLETED";
  hostId: string;
  host: { id: string; name: string | null; email: string };
  event: RumbleEvent;
  _count: { participants: number };
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

  useEffect(() => {
    fetchParties();
  }, []);

  const fetchParties = async () => {
    try {
      const res = await fetch("/api/parties");
      if (res.ok) {
        const data = await res.json();
        setParties(data);
      }
    } catch (error) {
      console.error("Failed to fetch parties:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinParty = async () => {
    setJoinError("");
    try {
      const res = await fetch("/api/parties/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: joinCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setJoinError(data.error);
        return;
      }

      setJoinDialogOpen(false);
      router.push(`/party/${data.partyId}`);
    } catch {
      setJoinError("Failed to join party");
    }
  };

  const getStatusColor = (status: Party["status"]) => {
    switch (status) {
      case "LOBBY":
        return "bg-blue-500";
      case "NUMBERS_ASSIGNED":
        return "bg-yellow-500";
      case "COMPLETED":
        return "bg-gray-500";
    }
  };

  const getStatusLabel = (status: Party["status"]) => {
    switch (status) {
      case "LOBBY":
        return "Waiting";
      case "NUMBERS_ASSIGNED":
        return "Ready";
      case "COMPLETED":
        return "Finished";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Your Parties</h1>
          <div className="flex gap-4">
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-transparent border-white text-white hover:bg-white/10">
                  Join Party
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Join a Party</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    placeholder="Enter invite code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="text-center text-2xl tracking-widest"
                  />
                  {joinError && <p className="text-red-500 text-sm">{joinError}</p>}
                  <Button onClick={handleJoinParty} className="w-full">
                    Join Party
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Link href="/party/create">
              <Button className="bg-purple-600 hover:bg-purple-700">
                Create Party
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading...</div>
        ) : parties.length === 0 ? (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-12 text-center">
              <p className="text-gray-400 mb-4">You haven&apos;t joined any parties yet.</p>
              <div className="flex justify-center gap-4">
                <Link href="/party/create">
                  <Button className="bg-purple-600 hover:bg-purple-700">Create Your First Party</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {parties.map((party) => (
              <Link key={party.id} href={`/party/${party.id}`}>
                <Card className="bg-gray-800/50 border-gray-700 hover:border-purple-500 transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-white">{party.name}</CardTitle>
                        <CardDescription className="text-gray-400">{party.event.name}</CardDescription>
                      </div>
                      <Badge className={getStatusColor(party.status)}>
                        {getStatusLabel(party.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>{party._count.participants} participant{party._count.participants !== 1 ? "s" : ""}</span>
                      {party.hostId === session?.user?.id && (
                        <Badge variant="outline" className="text-yellow-500 border-yellow-500">Host</Badge>
                      )}
                    </div>
                    <div className="mt-4 p-2 bg-gray-900/50 rounded text-center">
                      <span className="text-xs text-gray-500">Invite Code</span>
                      <div className="text-lg font-mono text-white tracking-widest">{party.inviteCode}</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
