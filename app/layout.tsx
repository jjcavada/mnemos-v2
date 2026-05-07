import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { hasValidSessionValue, SESSION_COOKIE_NAME } from "@/lib/api-auth";

export const metadata: Metadata = {
  title: "mnemos · second brain",
  description: "Personal RAG memory system"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const initialAuthenticated = hasValidSessionValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppShell initialAuthenticated={initialAuthenticated}>{children}</AppShell>
      </body>
    </html>
  );
}
