"use client";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { CommandK } from "@/components/CommandK";
import { FilmGrain } from "@/components/FilmGrain";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <Header />
      <main className="absolute top-[44px] left-[40px] right-0 bottom-0 overflow-hidden">
        {children}
      </main>
      <FilmGrain />
      <CommandK />
    </>
  );
}
