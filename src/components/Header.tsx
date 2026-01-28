"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  showBackLink?: { href: string; label: string };
}

export function Header({ showBackLink }: HeaderProps = {}) {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";

  return (
    <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            {showBackLink && (
              <Link href={showBackLink.href} className="text-gray-400 hover:text-white text-sm">
                &larr; {showBackLink.label}
              </Link>
            )}
            <Link href={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-2">
              {/* Inline SVG icon from logo.svg */}
              <svg width="40" height="40" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#7c3aed"/>
                    <stop offset="100%" stopColor="#9333ea"/>
                  </linearGradient>
                  <linearGradient id="diceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24"/>
                    <stop offset="100%" stopColor="#f59e0b"/>
                  </linearGradient>
                </defs>
                <circle cx="22" cy="22" r="20" fill="url(#bgGrad)"/>
                <path d="M8 16 H36" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 22 H36" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 28 H36" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/>
                <rect x="14" y="14" width="16" height="16" rx="2" fill="url(#diceGrad)" transform="rotate(15, 22, 22)"/>
                <circle cx="18" cy="18" r="1.5" fill="#7c3aed" transform="rotate(15, 22, 22)"/>
                <circle cx="22" cy="22" r="1.5" fill="#7c3aed" transform="rotate(15, 22, 22)"/>
                <circle cx="26" cy="26" r="1.5" fill="#7c3aed" transform="rotate(15, 22, 22)"/>
              </svg>
              <span className="text-2xl font-bold">
                <span className="text-purple-400">Rumble</span>
                <span className="text-yellow-400">Roll</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                {session?.user?.isAdmin && (
                  <Link href="/admin">
                    <Button variant="ghost" className="text-yellow-400 hover:text-yellow-300">
                      Admin
                    </Button>
                  </Link>
                )}
                <span className="text-gray-300 hidden sm:inline">
                  {session?.user?.name || session?.user?.email}
                </span>
                <Button variant="ghost" onClick={() => signOut()} className="text-gray-300">
                  Sign Out
                </Button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
