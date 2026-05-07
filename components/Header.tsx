"use client";
import { useEffect } from "react";
import { Search } from "lucide-react";
import { useMemoriesStore } from "@/store/memories";
import { useCommandK } from "@/components/CommandK";

export function Header() {
  const { load } = useMemoriesStore();
  const { open } = useCommandK();

  useEffect(() => { load(); }, [load]);

  // global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="absolute top-0 left-[40px] right-0 h-[44px] z-20 flex items-center justify-between px-5 pointer-events-none">
      <div className="flex items-center gap-3 pointer-events-auto">
        <span className="font-mono text-[10px] tracking-[0.32em] text-text-3 uppercase">mnemos</span>
        <span className="h-3 w-px bg-border" />
        <span className="font-mono text-[10px] tracking-[0.18em] text-text-4 uppercase">second brain</span>
      </div>

      <button
        onClick={open}
        className="pointer-events-auto inline-flex items-center gap-2.5 h-7 px-2.5 rounded-md text-text-3 hover:text-text-1 transition-colors"
        style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.08)" }}
      >
        <Search className="w-3 h-3" />
        <span className="text-[11px]">Search · Jump</span>
        <span className="font-mono text-[9.5px] text-text-4 tracking-wider px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.06)" }}>
          ⌘K
        </span>
      </button>
    </header>
  );
}
