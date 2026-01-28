"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Header } from "@/components/Header";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

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

  // Show loading while checking auth status
  if (status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Header />

      <div className="container mx-auto px-4 py-16">
        {/* Hero */}
        <main className="flex flex-col items-center text-center py-20">
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 leading-tight">
            Royal Rumble
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
              Party Game
            </span>
          </h1>

          <p className="text-xl text-gray-300 max-w-2xl mb-12">
            Host an epic watch party! Distribute entry numbers among your friends,
            track eliminations in real-time, and crown the ultimate winner.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-20">
            <Link href="/register">
              <Button size="lg" className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-8 py-6 text-lg">
                Create a Party
              </Button>
            </Link>
            {session ? (
              <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white/10 px-8 py-6 text-lg">
                    Join a Party
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
            ) : (
              <Link href="/login">
                <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white/10 px-8 py-6 text-lg">
                  Join a Party
                </Button>
              </Link>
            )}
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl">
            <FeatureCard
              title="Random Numbers"
              description="Fairly distribute all 30 entry numbers among your party guests"
              icon="dice"
            />
            <FeatureCard
              title="Live Tracking"
              description="Watch eliminations update in real-time on your TV display"
              icon="tv"
            />
            <FeatureCard
              title="Leaderboard"
              description="See who's winning as wrestlers get eliminated throughout the match"
              icon="trophy"
            />
          </div>
        </main>

        {/* How it works */}
        <section className="py-16">
          <h2 className="text-3xl font-bold text-white text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <StepCard step={1} title="Create" description="Host creates a party and gets an invite code" />
            <StepCard step={2} title="Invite" description="Share the code with your friends to join" />
            <StepCard step={3} title="Distribute" description="Randomly assign all 30 entry numbers" />
            <StepCard step={4} title="Track" description="Update eliminations live during the match" />
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-gray-500 py-8 border-t border-gray-800">
          <p>Made for Royal Rumble watch parties everywhere</p>
        </footer>
      </div>
    </div>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  const getIcon = () => {
    switch (icon) {
      case "dice":
        return (
          <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2"/>
            <circle cx="8" cy="8" r="1" fill="currentColor"/>
            <circle cx="12" cy="12" r="1" fill="currentColor"/>
            <circle cx="16" cy="16" r="1" fill="currentColor"/>
          </svg>
        );
      case "tv":
        return (
          <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="2" y="4" width="20" height="14" rx="2" strokeWidth="2"/>
            <path d="M8 21h8" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 18v3" strokeWidth="2"/>
          </svg>
        );
      case "trophy":
        return (
          <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M6 9H3a1 1 0 00-1 1v2a4 4 0 004 4h0" strokeWidth="2"/>
            <path d="M18 9h3a1 1 0 011 1v2a4 4 0 01-4 4h0" strokeWidth="2"/>
            <path d="M6 3h12v10a6 6 0 11-12 0V3z" strokeWidth="2"/>
            <path d="M9 21h6" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 17v4" strokeWidth="2"/>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
      <div className="mb-4 flex justify-center">{getIcon()}</div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

function StepCard({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-purple-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
        {step}
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}
