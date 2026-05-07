"use client";
import { useMemo } from "react";
import { applyFilters, useMemoriesStore } from "@/store/memories";

export function GraphCommandDeck() {
  const { memories, relationships } = useMemoriesStore();

  const stats = useMemo(() => {
    const filtered = applyFilters(memories);
    const filteredIds = new Set(filtered.map(m => m.id));
    const visibleLinks = relationships.filter(r => filteredIds.has(r.from_memory) && filteredIds.has(r.to_memory));
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = filtered.filter(m => m.created_at?.startsWith(today)).length;
    return {
      nodes: filtered.length,
      links: visibleLinks.length,
      today: todayCount
    };
  }, [memories, relationships]);

  return (
    <>
      {/* top-left structural strip — hairline only, no fill */}
      <div
        className="absolute top-3 left-3 z-10 inline-flex rounded-lg overflow-hidden pointer-events-none spring-in"
        style={{ border: "0.5px solid rgba(229,229,229,0.15)" }}
      >
        <Cell label="Nodes" value={stats.nodes} />
        <Cell label="Links" value={stats.links} />
        <Cell label="Today" value={stats.today} dimmed />
      </div>

      {/* bottom-left tiny status line */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
        <span className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-text-4">
          live · {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </>
  );
}

function Cell({ label, value, dimmed = false }: { label: string; value: number; dimmed?: boolean }) {
  return (
    <div
      className="flex flex-col gap-0.5 px-3.5 py-2.5"
      style={{ borderRight: "0.5px solid rgba(229,229,229,0.10)" }}
    >
      <span className="font-mono text-[8.5px] tracking-[0.22em] uppercase text-text-3">{label}</span>
      <span
        className={`font-mono text-[15px] leading-none tracking-tight ${dimmed ? "text-text-2" : "text-text-1"}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value.toString().padStart(2, "0")}
      </span>
    </div>
  );
}
