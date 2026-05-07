"use client";
import { useMemo } from "react";
import { useMemoriesStore, applyFilters } from "@/store/memories";
import { memoryColor } from "@/lib/colors";
import { MemoryDrawer } from "@/components/MemoryDrawer";

export default function TimelinePage() {
  const { memories, projectsById, select } = useMemoriesStore();

  const buckets = useMemo(() => {
    const filtered = applyFilters(memories);
    const map: Record<string, typeof filtered> = {};
    filtered.forEach(m => {
      const d = new Date(m.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      (map[key] ||= []).push(m);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [memories]);

  return (
    <div className="absolute inset-0 overflow-y-auto p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Timeline</h1>
      <p className="text-text-3 text-sm mb-8">Your memories grouped by month. Click any dot to open it.</p>

      <div className="relative pl-12">
        {/* vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

        {buckets.map(([month, items]) => (
          <section key={month} className="mb-10 relative">
            <div className="absolute -left-12 top-0 w-3 h-3 rounded-full bg-accent border-4 border-bg-0" />
            <div className="text-text-1 font-semibold text-lg mb-1">{month}</div>
            <div className="text-text-3 text-xs mb-4">{items.length} memories</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map(m => (
                <button
                  key={m.id}
                  onClick={() => select(m)}
                  className="mem-card text-left flex items-start gap-3"
                >
                  <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: memoryColor(m, projectsById) }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-text-1 font-medium truncate">{m.summary || m.content.slice(0, 70)}</div>
                    <div className="text-[11px] text-text-3 mt-0.5">
                      {new Date(m.created_at).toLocaleDateString()} · {m.is_project ? (m.project_id && projectsById[m.project_id]?.name) : (m.life_area ?? "life")} · {m.type}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <MemoryDrawer />
    </div>
  );
}
