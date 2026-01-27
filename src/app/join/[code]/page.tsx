"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function JoinPartyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const { status } = useSession();
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      // Store the invite code and redirect to login
      sessionStorage.setItem("pendingInviteCode", code);
      router.push("/login");
    }
  }, [status, code, router]);

  const handleJoin = async () => {
    setJoining(true);
    setError("");

    try {
      const res = await fetch("/api/parties/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      router.push(`/party/${data.partyId}`);
    } catch {
      setError("Failed to join party");
    } finally {
      setJoining(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-800/50 border-gray-700">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-white">Join Party</CardTitle>
          <CardDescription className="text-gray-400">
            You&apos;ve been invited to join a Royal Rumble party!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center p-4 bg-gray-900/50 rounded-lg">
            <span className="text-xs text-gray-500 block mb-1">Invite Code</span>
            <span className="text-3xl font-mono text-white tracking-widest">{code.toUpperCase()}</span>
          </div>

          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500 rounded text-red-300 text-center">
              {error}
            </div>
          )}

          <Button
            onClick={handleJoin}
            disabled={joining}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {joining ? "Joining..." : "Join This Party"}
          </Button>

          <div className="text-center">
            <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm">
              Go to Dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
