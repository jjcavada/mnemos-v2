"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { create } from "zustand";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CornerDownLeft,
  Crosshair,
  FileText,
  ListTree,
  Network,
  PenLine,
  Search,
  Sparkles,
  Tag,
  User,
  Users
} from "lucide-react";
import { useMemoriesStore } from "@/store/memories";
import { useGraphFocus } from "@/store/graph-focus";
import type { Entity } from "@/lib/types";

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

type CmdItem =
  | { kind: "ask";    label: string; hint: string; icon: any; href: string }
  | { kind: "nav";    label: string; hint: string; icon: any; href: string }
  | { kind: "graph";  label: string; hint: string; icon: any; targetId: string; selectMemory?: boolean };

export function CommandK() {
  const { isOpen, close } = useCommandK();
  const router = useRouter();
  const pathname = usePathname();
  const { memories, projectsById, projectsBySlug, lifeAreas } = useMemoriesStore();
  const focusGraph = useGraphFocus(s => s.focus);

  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const [entities, setEntities] = useState<Entity[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // load entities lazily — once per session, on first open
  useEffect(() => {
    if (!isOpen) return;
    if (entities.length > 0) return;
    let cancelled = false;
    fetch("/api/entities")
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (cancelled) return;
        if (j?.ok && Array.isArray(j.entities)) setEntities(j.entities);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen, entities.length]);

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

  const items: CmdItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const navMatches: CmdItem[] = NAV_COMMANDS.filter(c =>
      !q || c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q)
    );

    if (!q) return navMatches;

    // ----- entity matches: name, slug, or aliases -----
    const entityMatches: CmdItem[] = [];
    for (const e of entities) {
      const aliases = Array.isArray((e.metadata as any)?.aliases)
        ? ((e.metadata as any).aliases as string[]).filter(a => typeof a === "string")
        : [];
      const haystack = [e.name, e.slug, ...aliases].join(" ").toLowerCase();
      if (!haystack.includes(q)) continue;

      // resolve entity → graph node
      const primary = (e.metadata as any)?.primary_project;
      let targetId: string | null = null;
      let selectMemory = false;
      if (typeof primary === "string" && primary && projectsBySlug[primary]) {
        targetId = `cat:project:${projectsBySlug[primary].id}`;
      } else {
        // fall back to first memory tagged with this entity slug
        const mem = memories.find(m =>
          (m.entities ?? []).some(s => String(s).toLowerCase() === e.slug.toLowerCase())
        );
        if (mem) { targetId = mem.id; selectMemory = true; }
      }

      if (!targetId) continue;
      const projectLabel = typeof primary === "string" && primary && projectsBySlug[primary]
        ? projectsBySlug[primary].name
        : "memory match";
      entityMatches.push({
        kind: "graph",
        label: e.name,
        hint: `entity · ${projectLabel}`,
        icon: e.kind === "person" ? User : Tag,
        targetId,
        selectMemory
      });
      if (entityMatches.length >= 5) break;
    }

    // ----- project hub matches -----
    const projectMatches: CmdItem[] = [];
    for (const p of Object.values(projectsById)) {
      const hay = `${p.name} ${p.slug}`.toLowerCase();
      if (!hay.includes(q)) continue;
      projectMatches.push({
        kind: "graph",
        label: p.name,
        hint: "project hub",
        icon: Crosshair,
        targetId: `cat:project:${p.id}`
      });
      if (projectMatches.length >= 4) break;
    }

    // ----- life-area hub matches -----
    const lifeMatches: CmdItem[] = [];
    for (const la of lifeAreas) {
      const hay = `${la.name} ${la.slug}`.toLowerCase();
      if (!hay.includes(q)) continue;
      lifeMatches.push({
        kind: "graph",
        label: la.name,
        hint: "life-area hub",
        icon: Crosshair,
        targetId: `cat:life:${la.slug}`
      });
      if (lifeMatches.length >= 3) break;
    }

    // ----- meta: Links hub (only present when there are link memories) -----
    const metaMatches: CmdItem[] = [];
    const hasLinkMemories = memories.some(m =>
      typeof m.source_url === "string" && /^https?:\/\//i.test(m.source_url)
    );
    if (hasLinkMemories && ("links".includes(q) || q.includes("link") || q.includes("github") || q.includes("url"))) {
      metaMatches.push({
        kind: "graph",
        label: "Links",
        hint: "external URLs · Hermes captures",
        icon: Crosshair,
        targetId: "cat:meta:links"
      });
    }

    // ----- memory matches: summary or content -----
    const memoryMatches: CmdItem[] = [];
    for (const m of memories) {
      const hay = `${m.summary ?? ""} ${m.content ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
      const label = m.summary?.trim() || m.content.slice(0, 60).trim();
      memoryMatches.push({
        kind: "graph",
        label,
        hint: `memory · ${m.type}`,
        icon: FileText,
        targetId: m.id,
        selectMemory: true
      });
      if (memoryMatches.length >= 5) break;
    }

    // ----- ask passthrough — always available when query is meaningful -----
    const ask: CmdItem[] = q.length >= 2
      ? [{ kind: "ask", label: `Ask: "${query.trim()}"`, hint: "open in Recall", icon: Sparkles, href: `/recall?q=${encodeURIComponent(query.trim())}` }]
      : [];

    // dedupe by (kind,targetId|href)
    const out: CmdItem[] = [];
    const seen = new Set<string>();
    for (const it of [...entityMatches, ...projectMatches, ...lifeMatches, ...metaMatches, ...memoryMatches, ...ask, ...navMatches]) {
      const key = it.kind === "graph" ? `g:${it.targetId}` : `n:${it.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
    return out;
  }, [query, entities, memories, projectsById, projectsBySlug, lifeAreas]);

  function pick(idx: number) {
    const item = items[idx];
    if (!item) return;
    close();
    if (item.kind === "graph") {
      focusGraph(item.targetId, item.selectMemory ?? false);
      if (pathname !== "/graph") router.push("/graph");
      return;
    }
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
            placeholder="Search entities, projects, memories…"
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
                key={`${it.kind}-${idx}-${it.label}`}
                onMouseEnter={() => setHi(idx)}
                onClick={() => pick(idx)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                style={{ background: active ? "rgba(255,255,255,0.04)" : "transparent" }}
              >
                <Icon className="w-3.5 h-3.5 text-text-3 shrink-0" />
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
