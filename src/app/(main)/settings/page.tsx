"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Header } from "@/components/Header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageSearchDialog } from "@/components/ui/image-search-dialog";
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

// DiceBear avatar configuration
const AVATAR_STYLES = [
  { id: "avataaars", label: "Cartoon" },
  { id: "fun-emoji", label: "Emoji" },
  { id: "bottts", label: "Robot" },
  { id: "pixel-art", label: "Pixel" },
  { id: "lorelei", label: "Lorelei" },
  { id: "notionists", label: "Notionists" },
  { id: "thumbs", label: "Thumbs" },
  { id: "shapes", label: "Shapes" },
] as const;

// Generate random seeds for avatar options
const generateRandomSeeds = (count: number = 12): string[] => {
  const words = [
    "tiger", "eagle", "storm", "blaze", "frost", "shadow", "cosmic", "neon",
    "phoenix", "dragon", "thunder", "crystal", "mystic", "ember", "lunar", "solar",
    "vortex", "nebula", "aurora", "zenith", "azure", "crimson", "jade", "obsidian",
    "stellar", "quantum", "cipher", "prism", "apex", "nova", "pulse", "spark",
    "echo", "drift", "flux", "surge", "volt", "blitz", "rush", "flash",
    "wave", "reef", "peak", "vale", "brook", "ridge", "cliff", "shore",
  ];

  const seeds: string[] = [];
  const usedIndices = new Set<number>();

  while (seeds.length < count) {
    const randomIndex = Math.floor(Math.random() * words.length);
    if (!usedIndices.has(randomIndex)) {
      usedIndices.add(randomIndex);
      // Add a random suffix to make seeds even more unique
      seeds.push(`${words[randomIndex]}${Math.floor(Math.random() * 1000)}`);
    }
  }

  return seeds;
};

const getDiceBearUrl = (style: string, seed: string) =>
  `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;

const parseDiceBearUrl = (url: string): { style: string; seed: string } | null => {
  const match = url.match(/api\.dicebear\.com\/7\.x\/([^/]+)\/svg\?seed=([^&]+)/);
  if (match) {
    return { style: match[1], seed: match[2] };
  }
  return null;
};

export default function SettingsPage() {
  const router = useRouter();
  const { update } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [venmoHandle, setVenmoHandle] = useState("");
  const [cashAppHandle, setCashAppHandle] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [bio, setBio] = useState("");
  const [selectedAvatarStyle, setSelectedAvatarStyle] = useState<string>("avataaars");
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const [avatarSeeds, setAvatarSeeds] = useState<string[]>(() => generateRandomSeeds(12));

  const regenerateAvatars = useCallback(() => {
    setAvatarSeeds(generateRandomSeeds(12));
  }, []);

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

      // If user has a DiceBear URL, set the style tab to match
      if (data.profileImageUrl) {
        const parsed = parseDiceBearUrl(data.profileImageUrl);
        if (parsed) {
          setSelectedAvatarStyle(parsed.style);
        }
      }
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

      // Refresh the session to update header with new profile data
      await update({ profileImageUrl });
      router.refresh();
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
                  Choose an avatar below or enter a custom image URL
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

              {/* Avatar Picker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-white">Profile Avatar</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={regenerateAvatars}
                    className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/30"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    New Options
                  </Button>
                </div>

                {/* Style Tabs */}
                <div className="flex flex-wrap gap-2">
                  {AVATAR_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedAvatarStyle(style.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedAvatarStyle === style.id
                          ? "bg-purple-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>

                {/* Avatar Grid - scrollable */}
                <div className="grid grid-cols-4 gap-3 p-3 bg-gray-900/50 rounded-lg max-h-80 overflow-y-auto">
                  {avatarSeeds.map((seed) => {
                    const avatarUrl = getDiceBearUrl(selectedAvatarStyle, seed);
                    const isSelected = profileImageUrl === avatarUrl;

                    return (
                      <button
                        key={seed}
                        type="button"
                        onClick={() => setProfileImageUrl(avatarUrl)}
                        className={`relative aspect-square rounded-lg overflow-hidden transition-all ${
                          isSelected
                            ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-800"
                            : "hover:ring-2 hover:ring-gray-500 hover:ring-offset-2 hover:ring-offset-gray-800"
                        }`}
                      >
                        <img
                          src={avatarUrl}
                          alt={`Avatar ${seed}`}
                          className="w-full h-full object-cover bg-gray-700"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-purple-600/20 flex items-center justify-center">
                            <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-gray-500 text-sm">Click &quot;New Options&quot; to see different avatars</p>
              </div>

              {/* Custom URL Input */}
              <div className="space-y-2">
                <Label htmlFor="profileImageUrl" className="text-white">Or Use Custom Image URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="profileImageUrl"
                    placeholder="https://example.com/your-image.jpg"
                    value={profileImageUrl}
                    onChange={(e) => setProfileImageUrl(e.target.value)}
                    className="bg-gray-900 border-gray-600 text-white flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setImageSearchOpen(true)}
                    className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    Search Images
                  </Button>
                </div>
                <p className="text-gray-500 text-sm">Enter a direct link or search for stock photos</p>
              </div>

              <ImageSearchDialog
                open={imageSearchOpen}
                onOpenChange={setImageSearchOpen}
                onSelect={(url) => setProfileImageUrl(url)}
                source="pexels"
              />

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
