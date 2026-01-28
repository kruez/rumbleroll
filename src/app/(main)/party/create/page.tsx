"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Header } from "@/components/Header";

interface RumbleEvent {
  id: string;
  name: string;
  year: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
}

export default function CreatePartyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [eventId, setEventId] = useState("");
  const [hostParticipates, setHostParticipates] = useState(true);
  const [events, setEvents] = useState<RumbleEvent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
        // Auto-select the first active or not-started event
        const activeEvent = data.find(
          (e: RumbleEvent) => e.status === "IN_PROGRESS" || e.status === "NOT_STARTED"
        );
        if (activeEvent) {
          setEventId(activeEvent.id);
        } else if (data.length > 0) {
          setEventId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!eventId) {
      setError("Please select an event");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, eventId, hostParticipates }),
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <Header showBackLink={{ href: "/dashboard", label: "Back to Dashboard" }} />

      <div className="container mx-auto px-4 py-12 max-w-md">
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
                <Label htmlFor="event" className="text-white">Event</Label>
                {loadingEvents ? (
                  <div className="text-gray-400 text-sm">Loading events...</div>
                ) : events.length === 0 ? (
                  <div className="text-yellow-400 text-sm">
                    No events available. Please contact an admin to create one.
                  </div>
                ) : (
                  <Select value={eventId} onValueChange={setEventId}>
                    <SelectTrigger className="bg-gray-900 border-gray-600 text-white">
                      <SelectValue placeholder="Select an event" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.name} ({event.year})
                          {event.status === "IN_PROGRESS" && " - Live"}
                          {event.status === "COMPLETED" && " - Finished"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex items-center space-x-3 py-2">
                <Checkbox
                  id="hostParticipates"
                  checked={hostParticipates}
                  onCheckedChange={(checked) => setHostParticipates(checked === true)}
                  className="border-gray-600 data-[state=checked]:bg-purple-600"
                />
                <Label htmlFor="hostParticipates" className="text-white cursor-pointer">
                  Include me as a player
                </Label>
              </div>
              <p className="text-gray-500 text-sm -mt-4">
                {hostParticipates
                  ? "You'll receive entry numbers along with other players"
                  : "You'll host the party but won't receive any entry numbers"}
              </p>

              <Button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700"
                disabled={loading || !eventId || events.length === 0}
              >
                {loading ? "Creating..." : "Create Party"}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}
