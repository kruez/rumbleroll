import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <nav className="flex justify-between items-center mb-16">
          <div className="text-2xl font-bold text-white">RumbleRoll</div>
          <div className="space-x-4">
            <Link href="/login">
              <Button variant="ghost" className="text-white hover:text-purple-300">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button className="bg-purple-600 hover:bg-purple-700">
                Sign Up
              </Button>
            </Link>
          </div>
        </nav>

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
            <Link href="/login">
              <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white/10 px-8 py-6 text-lg">
                Join a Party
              </Button>
            </Link>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl">
            <FeatureCard
              title="Random Numbers"
              description="Fairly distribute all 30 entry numbers among your party guests"
              icon="🎲"
            />
            <FeatureCard
              title="Live Tracking"
              description="Watch eliminations update in real-time on your TV display"
              icon="📺"
            />
            <FeatureCard
              title="Leaderboard"
              description="See who's winning as wrestlers get eliminated throughout the match"
              icon="🏆"
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
  return (
    <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
      <div className="text-4xl mb-4">{icon}</div>
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
