"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemoriesStore } from "@/store/memories";
import { BrainCircuit, Database, Search } from "lucide-react";
import { useEffect, useMemo } from "react";

const TABS = [
  { href: "/graph", label: "Graph" },
  { href: "/recall", label: "Recall" },
  { href: "/capture", label: "Capture" },
  { href: "/timeline", label: "Timeline" },
  { href: "/journal", label: "Journal" },
  { href: "/people", label: "People" },
  { href: "/list", label: "List" }
];

export function Header() {
  const pathname = usePathname();
  const { setSearch, filters, load, memories, relationships } = useMemoriesStore();
  const totals = useMemo(() => ({
    life: memories.filter(m => !m.is_project).length,
    projects: memories.filter(m => m.is_project).length,
    links: relationships.length
  }), [memories, relationships]);

  useEffect(() => { load(); }, [load]);

  return (
    <header className="absolute top-0 left-0 right-0 h-[56px] bg-black/80 border-b border-cyan-300/15 z-20 flex items-center px-4 gap-5 backdrop-blur">
      <div className="flex items-center gap-3 min-w-[220px]">
        <div className="w-7 h-7 rounded border border-cyan-300/30 bg-cyan-300/10 flex items-center justify-center">
          <BrainCircuit className="w-4 h-4 text-cyan-200" />
        </div>
        <div>
          <div className="font-mono text-[12px] tracking-[0.28em] text-text-1">MNEMOS</div>
          <div className="text-[10px] text-cyan-200/70 tracking-wider">SECOND BRAIN</div>
        </div>
      </div>

      <nav className="flex items-center gap-1">
        {TABS.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className={`px-3 py-1 rounded text-[12px] font-semibold transition-all ${
              pathname === t.href
                ? "bg-cyan-200 text-black"
                : "text-text-3 hover:text-cyan-100"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="hidden xl:flex items-center gap-3 font-mono text-[10px] text-text-3">
        <StatusChip label="MEM" value={memories.length} />
        <StatusChip label="LINK" value={totals.links} />
        <StatusChip label="LIFE" value={totals.life} />
        <StatusChip label="PROJ" value={totals.projects} />
      </div>

      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-3 h-9 px-3 bg-white/[0.04] border border-cyan-300/15 rounded-md w-[420px]">
          <Search className="w-4 h-4 text-cyan-200/70" />
          <input
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search everything..."
            className="bg-transparent flex-1 outline-none text-sm placeholder-text-3"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 bg-black/40 border border-white/10 rounded text-text-2 font-mono">Ctrl+K</kbd>
        </div>
      </div>
    </header>
  );
}

function StatusChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex items-center gap-1.5 border border-white/10 bg-white/[0.03] rounded px-2 py-1">
      <Database className="w-3 h-3 text-cyan-200/70" />
      <span>{label}</span>
      <span className="text-cyan-100">{value}</span>
    </div>
  );
}
