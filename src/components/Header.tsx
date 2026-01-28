"use client";

import Link from "next/link";
import Image from "next/image";
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
              <Image src="/logo.svg" alt="RumbleRoll" width={160} height={40} priority />
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
