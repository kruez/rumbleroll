import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login") ||
                     req.nextUrl.pathname.startsWith("/register");
  const isPublicPage = req.nextUrl.pathname === "/" ||
                       req.nextUrl.pathname.startsWith("/join/");
  const isApiRoute = req.nextUrl.pathname.startsWith("/api");

  // Allow API routes to handle their own auth
  if (isApiRoute) {
    return NextResponse.next();
  }

  // Redirect logged in users away from auth pages
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  // Allow public pages and auth pages
  if (isPublicPage || isAuthPage) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
