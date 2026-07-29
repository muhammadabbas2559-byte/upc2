import type { Metadata } from "next";
import AppProviders from "@/components/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "IronForge Gym — Offline Management System",
  description:
    "Offline-first, encrypted, role-based gym management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="color-scheme" content="dark" />
        {/* Inter is bundled locally via next/font or Google? Offline requirement says all fonts local. We'll use system-ui fallback and not load external fonts. */}
      </head>
      <body className="bg-app text-primary min-h-screen">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
