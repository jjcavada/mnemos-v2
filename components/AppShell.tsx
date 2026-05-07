"use client";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <Sidebar />
      <main className="absolute top-[56px] left-[260px] right-0 bottom-0 overflow-hidden">
        {children}
      </main>
    </>
  );
}
