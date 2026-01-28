"use client";

import { useEffect, useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";

function JoinPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") || "";

  const [joinCode, setJoinCode] = useState(codeFromUrl);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);

  // Auto-join if logged in and code provided
  useEffect(() => {
    if (status === "authenticated" && codeFromUrl && !autoJoinAttempted) {
      setAutoJoinAttempted(true);
      handleJoin(codeFromUrl);
    }
  }, [status, codeFromUrl, autoJoinAttempted]);

  const handleJoin = async (code: string) => {
    setError("");
    setJoining(true);
    try {
      const res = await fetch("/api/parties/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        setJoining(false);
        return;
      }

      router.push(`/party/${data.partyId}`);
    } catch {
      setError("Failed to join party");
      setJoining(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode) {
      handleJoin(joinCode);
    }
  };

  // Show loading while checking auth
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  // If not logged in, redirect to login with return URL
  if (status === "unauthenticated") {
    const returnUrl = codeFromUrl ? `/join?code=${codeFromUrl}` : "/join";
    router.push(`/login?callbackUrl=${encodeURIComponent(returnUrl)}`);
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <p className="text-white">Redirecting to login...</p>
      </div>
    );
  }

  // Show joining state
  if (joining && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <p className="text-white text-xl">Joining party...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-16 flex justify-center">
        <Card className="w-full max-w-md bg-gray-800/50 border-gray-700">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">Join a Party</CardTitle>
            <CardDescription className="text-gray-400">
              Enter the invite code to join
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                placeholder="Enter invite code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="text-center text-2xl tracking-widest"
                autoFocus
              />
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <Button type="submit" className="w-full" disabled={!joinCode || joining}>
                {joining ? "Joining..." : "Join Party"}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm">
                &larr; Back to Dashboard
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    }>
      <JoinPageContent />
    </Suspense>
  );
}
