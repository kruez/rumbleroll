"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface ScoreboardDropdownProps {
  partyId: string;
  variant?: "default" | "outline";
}

export function ScoreboardDropdown({ partyId, variant = "outline" }: ScoreboardDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          className={
            variant === "outline"
              ? "bg-transparent border-white text-white hover:bg-white/10"
              : ""
          }
        >
          Scoreboard <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
        <DropdownMenuItem asChild className="text-white hover:bg-gray-700 cursor-pointer">
          <Link href={`/party/${partyId}/tv`}>
            Detailed View
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="text-white hover:bg-gray-700 cursor-pointer">
          <Link href={`/party/${partyId}/tv/v2`}>
            Simple View
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
