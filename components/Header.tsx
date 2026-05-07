"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemoriesStore } from "@/store/memories";
import { Search } from "lucide-react";
import { useEffect } from "react";

const TABS = [
  { href: "/graph", label: "Graph" },
  { href: "/timeline", label: "Timeline" },
  { href: "/journal", label: "Journal" },
  { href: "/people", label: "People" },
  { href: "/list", label: "List" }
];

export function Header() {
  const pathname = usePathname();
  const { setSearch, filters, load } = useMemoriesStore();

  useEffect(() => { load(); }, [load]);

  return (
    <header className="absolute top-0 left-0 right-0 h-[56px] bg-bg-1 border-b border-border z-20 flex items-center px-5 gap-6">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
        <div className="font-semibold tracking-wide">mnemos</div>
        <div className="text-[11px] text-text-3 ml-2">your second brain</div>
      </div>

      <nav className="flex items-center gap-1">
        {TABS.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className={`px-3 py-1 rounded-md text-[13px] font-medium transition-all ${
              pathname === t.href
                ? "bg-bg-3 text-text-1"
                : "text-text-3 hover:text-text-2"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-3 h-9 px-3 bg-bg-2 border border-border rounded-lg w-[420px]">
          <Search className="w-4 h-4 text-text-3" />
          <input
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search everything..."
            className="bg-transparent flex-1 outline-none text-sm placeholder-text-3"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 bg-bg-3 border border-border rounded text-text-2 font-mono">Ctrl+K</kbd>
        </div>
      </div>
    </header>
  );
}
