import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "mnemos · second brain",
  description: "Personal RAG memory system"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Header />
        <Sidebar />
        <main className="absolute top-[56px] left-[260px] right-0 bottom-0 overflow-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
