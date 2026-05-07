"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Network,
  Sparkles,
  PenLine,
  CalendarDays,
  BookOpen,
  Users,
  ListTree,
  Filter
} from "lucide-react";
import { useState } from "react";
import { useMemoriesStore } from "@/store/memories";
import { FilterPanel } from "@/components/FilterPanel";

const NAV = [
  { href: "/graph",    label: "Graph",    icon: Network },
  { href: "/recall",   label: "Recall",   icon: Sparkles },
  { href: "/capture",  label: "Capture",  icon: PenLine },
  { href: "/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/journal",  label: "Journal",  icon: BookOpen },
  { href: "/people",   label: "People",   icon: Users },
  { href: "/list",     label: "List",     icon: ListTree }
];

export function Sidebar() {
  const pathname = usePathname();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { memories } = useMemoriesStore();

  return (
    <>
      <aside
        className="absolute top-0 left-0 bottom-0 w-[40px] z-30 flex flex-col items-center pt-3 pb-3"
        style={{ background: "rgba(8, 8, 8, 0.65)", borderRight: "0.5px solid rgba(255,255,255,0.06)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)" }}
      >
        {/* tiny brand mark */}
        <div className="w-6 h-6 mb-4 flex items-center justify-center rounded-md" style={{ border: "0.5px solid rgba(229,229,229,0.35)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-text-1" />
        </div>

        {/* primary nav */}
        <nav className="flex flex-col gap-1 flex-1">
          {NAV.map(item => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`dock-btn ${active ? "active" : ""}`}
              >
                <Icon className="w-[15px] h-[15px]" strokeWidth={1.6} />
                <span className="dock-tip">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* filter toggle */}
        <button
          onClick={() => setFiltersOpen(v => !v)}
          className={`dock-btn ${filtersOpen ? "active" : ""}`}
          aria-label="Filters"
        >
          <Filter className="w-[15px] h-[15px]" strokeWidth={1.6} />
          <span className="dock-tip">Filters · {memories.length}</span>
        </button>
      </aside>

      <FilterPanel open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </>
  );
}
