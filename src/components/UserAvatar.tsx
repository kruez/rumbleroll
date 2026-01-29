"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserAvatarProps {
  name?: string | null;
  email?: string;
  profileImageUrl?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function UserAvatar({
  name,
  email,
  profileImageUrl,
  size = "default",
  className,
}: UserAvatarProps) {
  const displayName = name || email || "?";
  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : email?.[0].toUpperCase() || "?";

  return (
    <Avatar size={size} className={className}>
      {profileImageUrl && (
        <AvatarImage src={profileImageUrl} alt={displayName} />
      )}
      <AvatarFallback className="bg-purple-600 text-white">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
