"use client";

import { AuthProvider } from "@/context/AuthContext";

/**
 * Application-wide client providers.
 *
 * Auth must live above all routes so a successful encrypted-database login
 * survives client-side navigation from `/` to `/dashboard` without a second
 * provider briefly resetting the session to `null`.
 */
export default function AppProviders({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
