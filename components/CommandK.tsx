"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CornerDownLeft,
  ListTree,
  Network,
  PenLine,
  Search,
  Sparkles,
  Users
} from "lucide-react";

type CmdKState = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

export const useCommandK = create<CmdKState>((set, get) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set({ isOpen: !get().isOpen })
}));

const NAV_COMMANDS = [
  { kind: "nav", label: "Graph",    href: "/graph",    icon: Network,      hint: "constellation view" },
  { kind: "nav", label: "Recall",   href: "/recall",   icon: Sparkles,     hint: "ask the brain" },
  { kind: "nav", label: "Capture",  href: "/capture",  icon: PenLine,      hint: "save a memory" },
  { kind: "nav", label: "Timeline", href: "/timeline", icon: CalendarDays, hint: "month-by-month" },
  { kind: "nav", label: "Journal",  href: "/journal",  icon: BookOpen,     hint: "today's reflection" },
  { kind: "nav", label: "People",   href: "/people",   icon: Users,        hint: "entities & profiles" },
  { kind: "nav", label: "List",     href: "/list",     icon: ListTree,     hint: "flat memory list" }
] as const;

export function CommandK() {
  const { isOpen, close } = useCommandK();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setHi(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  type CmdItem =
    | { kind: "nav"; label: string; href: string; icon: any; hint: string }
    | { kind: "ask"; label: string; href: string; icon: any; hint: string };

  const items: CmdItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const navMatches: CmdItem[] = NAV_COMMANDS.filter(c => !q || c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q));
    const ask: CmdItem[] = q.length >= 2
      ? [{ kind: "ask", label: `Ask: "${query.trim()}"`, href: `/recall?q=${encodeURIComponent(query.trim())}`, icon: Sparkles, hint: "open in Recall" }]
      : [];
    return [...ask, ...navMatches];
  }, [query]);

  function pick(idx: number) {
    const item = items[idx];
    if (!item) return;
    close();
    router.push(item.href);
  }

  if (!isOpen) return null;

  return (
    <div className="cmdk-overlay spring-in" onClick={close}>
      <div className="cmdk-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
          <Search className="w-4 h-4 text-text-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHi(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, items.length - 1)); }
              if (e.key === "ArrowUp")   { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
              if (e.key === "Enter")     { e.preventDefault(); pick(hi); }
            }}
            placeholder="Search memories or jump to a view…"
            className="flex-1 bg-transparent outline-none text-[14px] placeholder-text-3 text-text-1"
          />
          <kbd className="font-mono text-[9px] tracking-wider text-text-4 px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.06)" }}>esc</kbd>
        </div>

        <div className="max-h-[420px] overflow-y-auto py-2">
          {items.length === 0 && (
            <div className="px-4 py-6 text-center text-text-3 text-[12px]">No matches.</div>
          )}
          {items.map((it, idx) => {
            const Icon = it.icon;
            const active = idx === hi;
            return (
              <button
                key={`${it.kind}-${it.label}-${idx}`}
                onMouseEnter={() => setHi(idx)}
                onClick={() => pick(idx)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                style={{ background: active ? "rgba(255,255,255,0.04)" : "transparent" }}
              >
                <Icon className="w-3.5 h-3.5 text-text-3" />
                <span className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="text-[13px] text-text-1 truncate">{it.label}</span>
                  <span className="text-[11px] text-text-4 truncate">{it.hint}</span>
                </span>
                {active && <CornerDownLeft className="w-3 h-3 text-text-2" />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-4 py-2 text-[10px] text-text-4 font-mono tracking-wider uppercase" style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
          <span>↑↓ navigate</span>
          <span className="flex items-center gap-1.5">enter <ArrowRight className="w-2.5 h-2.5" /> select</span>
        </div>
      </div>
    </div>
  );
}
