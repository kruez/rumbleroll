"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Header } from "@/components/Header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  venmoHandle: string | null;
  cashAppHandle: string | null;
  profileImageUrl: string | null;
  bio: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [venmoHandle, setVenmoHandle] = useState("");
  const [cashAppHandle, setCashAppHandle] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/user");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch profile");
      }
      const data: UserProfile = await res.json();
      setName(data.name || "");
      setVenmoHandle(data.venmoHandle || "");
      setCashAppHandle(data.cashAppHandle || "");
      setProfileImageUrl(data.profileImageUrl || "");
      setBio(data.bio || "");
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          venmoHandle,
          cashAppHandle,
          profileImageUrl,
          bio,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save profile");
        return;
      }

      toast.success("Profile saved successfully");
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return "?";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
        <Header />
        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <div className="text-center text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Header showBackLink={{ href: "/dashboard", label: "Back to Dashboard" }} />

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Profile Settings</CardTitle>
            <CardDescription className="text-gray-400">
              Update your profile information and payment handles
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Profile Picture Preview */}
              <div className="flex items-center gap-4">
                <Avatar size="lg" className="w-16 h-16">
                  <AvatarImage src={profileImageUrl || undefined} alt={name || "Profile"} />
                  <AvatarFallback className="bg-purple-600 text-white text-xl">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-gray-400 text-sm">
                  Enter an image URL below to set your profile picture
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">Display Name</Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profileImageUrl" className="text-white">Profile Image URL</Label>
                <Input
                  id="profileImageUrl"
                  placeholder="https://example.com/your-image.jpg"
                  value={profileImageUrl}
                  onChange={(e) => setProfileImageUrl(e.target.value)}
                  className="bg-gray-900 border-gray-600 text-white"
                />
                <p className="text-gray-500 text-sm">Enter a direct link to an image</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio" className="text-white">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={200}
                  className="bg-gray-900 border-gray-600 text-white resize-none"
                  rows={3}
                />
                <p className="text-gray-500 text-sm text-right">{bio.length}/200</p>
              </div>

              <div className="border-t border-gray-700 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Payment Handles</h3>
                <p className="text-gray-400 text-sm mb-4">
                  These will be shown to other players when they need to pay entry fees or send winnings.
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="venmoHandle" className="text-white">Venmo</Label>
                    <Input
                      id="venmoHandle"
                      placeholder="@username"
                      value={venmoHandle}
                      onChange={(e) => {
                        let value = e.target.value;
                        if (value && !value.startsWith("@")) {
                          value = "@" + value;
                        }
                        setVenmoHandle(value);
                      }}
                      className="bg-gray-900 border-gray-600 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cashAppHandle" className="text-white">Cash App</Label>
                    <Input
                      id="cashAppHandle"
                      placeholder="$cashtag"
                      value={cashAppHandle}
                      onChange={(e) => {
                        let value = e.target.value;
                        if (value && !value.startsWith("$")) {
                          value = "$" + value;
                        }
                        setCashAppHandle(value);
                      }}
                      className="bg-gray-900 border-gray-600 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                  className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}
