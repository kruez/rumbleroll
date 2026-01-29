import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
      profileImageUrl?: string;
    } & DefaultSession["user"];
  }

  interface User {
    isAdmin: boolean;
    profileImageUrl?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    isAdmin: boolean;
    profileImageUrl?: string;
  }
}
