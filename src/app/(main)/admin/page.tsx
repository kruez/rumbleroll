"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Header } from "@/components/Header";

interface RumbleEvent {
  id: string;
  name: string;
  year: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  _count: { parties: number; entries: number };
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<RumbleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventYear, setNewEventYear] = useState(new Date().getFullYear());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user?.isAdmin) {
      router.push("/dashboard");
      return;
    }
    fetchEvents();
  }, [session, status, router]);

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/admin/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEventName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newEventName, year: newEventYear }),
      });

      if (res.ok) {
        setCreateDialogOpen(false);
        setNewEventName("");
        fetchEvents();
      }
    } catch (error) {
      console.error("Failed to create event:", error);
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: RumbleEvent["status"]) => {
    switch (status) {
      case "NOT_STARTED":
        return <Badge className="bg-gray-500">Not Started</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-green-500">In Progress</Badge>;
      case "COMPLETED":
        return <Badge className="bg-blue-500">Completed</Badge>;
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (!session?.user?.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Header />

      {/* Page Header */}
      <div className="border-b border-gray-700 bg-gray-900/30">
        <div className="container mx-auto px-4 py-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-bold text-white">Rumble Events</h2>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700">
                Create Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="eventName">Event Name</Label>
                  <Input
                    id="eventName"
                    placeholder="e.g., Royal Rumble 2025"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventYear">Year</Label>
                  <Input
                    id="eventYear"
                    type="number"
                    value={newEventYear}
                    onChange={(e) => setNewEventYear(parseInt(e.target.value))}
                  />
                </div>
                <Button
                  onClick={handleCreateEvent}
                  className="w-full"
                  disabled={creating || !newEventName.trim()}
                >
                  {creating ? "Creating..." : "Create Event"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {events.length === 0 ? (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="py-12 text-center">
              <p className="text-gray-400 mb-4">No events created yet.</p>
              <Button
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => setCreateDialogOpen(true)}
              >
                Create Your First Event
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <Link key={event.id} href={`/admin/event/${event.id}`}>
                <Card className="bg-gray-800/50 border-gray-700 hover:border-purple-500 transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-white">{event.name}</CardTitle>
                        <CardDescription className="text-gray-400">
                          {event.year}
                        </CardDescription>
                      </div>
                      {getStatusBadge(event.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-gray-400">
                      {event._count.parties} {event._count.parties === 1 ? "party" : "parties"} using this event
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
