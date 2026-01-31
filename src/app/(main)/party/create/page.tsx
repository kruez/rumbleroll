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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Header } from "@/components/Header";

type DistributionMode = "EXCLUDE" | "BUY_EXTRA" | "SHARED";

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
  const [distributionMode, setDistributionMode] = useState<DistributionMode>("EXCLUDE");
  const [hasEntryFee, setHasEntryFee] = useState(false);
  const [entryFee, setEntryFee] = useState("");
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
        body: JSON.stringify({
          name,
          eventId,
          hostParticipates,
          distributionMode,
          entryFee: hasEntryFee && entryFee ? parseFloat(entryFee) : null,
        }),
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
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
                ) : events.length === 1 ? (
                  <div className="bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white">
                    {events[0].name} ({events[0].year})
                    {events[0].status === "IN_PROGRESS" && " - Live"}
                    {events[0].status === "COMPLETED" && " - Finished"}
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

              <div className="border-t border-gray-700 pt-4">
                <Label className="text-white mb-3 block">Number Distribution Mode</Label>
                <RadioGroup
                  value={distributionMode}
                  onValueChange={(value) => setDistributionMode(value as DistributionMode)}
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-3 p-3 rounded-lg bg-gray-900/50 border border-gray-700 cursor-pointer hover:border-purple-500/50 transition-colors">
                    <RadioGroupItem value="EXCLUDE" id="exclude" className="border-gray-600 text-purple-600 mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="exclude" className="text-white cursor-pointer font-medium">
                        Equal Only (Recommended)
                      </Label>
                      <p className="text-gray-400 text-sm mt-1">
                        Numbers that don&apos;t divide evenly are not in play. Everyone gets the same count.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 rounded-lg bg-gray-900/50 border border-gray-700 cursor-pointer hover:border-purple-500/50 transition-colors">
                    <RadioGroupItem value="BUY_EXTRA" id="buy-extra" className="border-gray-600 text-purple-600 mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="buy-extra" className="text-white cursor-pointer font-medium">
                        Buy Extra Entries
                      </Label>
                      <p className="text-gray-400 text-sm mt-1">
                        Remainder numbers can be purchased by players. Host assigns them manually.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 rounded-lg bg-gray-900/50 border border-gray-700 cursor-pointer hover:border-purple-500/50 transition-colors">
                    <RadioGroupItem value="SHARED" id="shared" className="border-gray-600 text-purple-600 mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="shared" className="text-white cursor-pointer font-medium">
                        Shared Numbers
                      </Label>
                      <p className="text-gray-400 text-sm mt-1">
                        Remainder numbers are shared by random groups. If shared number wins, they split the prize.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <div className="flex items-center space-x-3 py-2">
                  <Checkbox
                    id="hasEntryFee"
                    checked={hasEntryFee}
                    onCheckedChange={(checked) => setHasEntryFee(checked === true)}
                    className="border-gray-600 data-[state=checked]:bg-purple-600"
                  />
                  <Label htmlFor="hasEntryFee" className="text-white cursor-pointer">
                    This party has an entry fee
                  </Label>
                </div>

                {hasEntryFee && (
                  <div className="space-y-2 mt-3">
                    <Label htmlFor="entryFee" className="text-white">Entry Fee Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <Input
                        id="entryFee"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="10.00"
                        value={entryFee}
                        onChange={(e) => setEntryFee(e.target.value)}
                        className="bg-gray-900 border-gray-600 text-white pl-7"
                      />
                    </div>
                    <p className="text-gray-500 text-sm">
                      Fees are informational only - collect payments separately via Venmo or CashApp
                    </p>
                  </div>
                )}
              </div>

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
