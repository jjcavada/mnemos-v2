"use client";
import { useEffect, useState, useMemo } from "react";
import { sb } from "@/lib/supabase";
import type { Entity } from "@/lib/types";
import { useMemoriesStore } from "@/store/memories";

export default function PeoplePage() {
  const { memories, select } = useMemoriesStore();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    sb.from("entities").select("*").order("name").then(({ data }) => setEntities((data ?? []) as Entity[]));
  }, []);

  // Aggregate entity mentions from memories
  const aggregated = useMemo(() => {
    const counts: Record<string, { entity: Entity | null; mentions: number; ids: string[] }> = {};
    memories.forEach(m => {
      m.entities?.forEach(e => {
        const key = e.toLowerCase();
        if (!counts[key]) counts[key] = { entity: entities.find(x => x.slug === key) ?? null, mentions: 0, ids: [] };
        counts[key].mentions++;
        counts[key].ids.push(m.id);
      });
    });
    return Object.entries(counts).sort((a, b) => b[1].mentions - a[1].mentions);
  }, [memories, entities]);

  const visible = filter === "all" ? aggregated : aggregated.filter(([, v]) => v.entity?.kind === filter);

  return (
    <div className="absolute inset-0 overflow-y-auto p-8">
      <h1 className="text-2xl font-semibold mb-1">People & Entities</h1>
      <p className="text-text-3 text-sm mb-6">People, places, books, tools — everything that recurs across your memories.</p>

      <div className="flex gap-2 mb-6">
        {["all", "person", "place", "organization", "book", "tool", "concept"].map(k => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`pill ${filter === k ? "active" : ""}`}
          >{k}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {visible.map(([key, v]) => (
          <div key={key} className="bg-bg-1 border border-border rounded-lg p-4">
            <div className="text-text-1 font-semibold text-sm">{v.entity?.name ?? key}</div>
            <div className="text-[11px] text-text-3 mt-1">{v.entity?.kind ?? "unknown"} · {v.mentions} mention{v.mentions !== 1 ? "s" : ""}</div>
            <div className="mt-3 space-y-1">
              {v.ids.slice(0, 3).map(id => {
                const m = memories.find(x => x.id === id);
                if (!m) return null;
                return (
                  <button
                    key={id}
                    onClick={() => select(m)}
                    className="block w-full text-left text-[11px] text-text-3 hover:text-text-1 truncate"
                  >· {m.summary || m.content.slice(0, 50)}</button>
                );
              })}
              {v.ids.length > 3 && <div className="text-[10px] text-text-4">+{v.ids.length - 3} more</div>}
            </div>
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="text-text-3 text-sm py-12 text-center">
          No entities yet. Auto-capture (Phase 2) will populate this from your memory content.
        </div>
      )}
    </div>
  );
}
