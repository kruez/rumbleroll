"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CreatePartyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [eventName, setEventName] = useState("Royal Rumble 2025");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, eventName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create party");
        return;
      }

      router.push(`/party/${data.id}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-12">
      <div className="container mx-auto px-4 max-w-md">
        <Link href="/dashboard" className="text-gray-400 hover:text-white mb-6 inline-block">
          &larr; Back to Dashboard
        </Link>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Create a Party</CardTitle>
            <CardDescription className="text-gray-400">
              Set up a new Royal Rumble watch party
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">Party Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Mike's Watch Party"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-gray-900 border-gray-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="eventName" className="text-white">Event Name</Label>
                <Input
                  id="eventName"
                  placeholder="e.g., Royal Rumble 2025"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white"
                />
              </div>

              <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700" disabled={loading}>
                {loading ? "Creating..." : "Create Party"}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}
