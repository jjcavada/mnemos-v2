"use client";
import { useMemo } from "react";
import { useMemoriesStore, applyFilters } from "@/store/memories";
import { MemoryDrawer } from "@/components/MemoryDrawer";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

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
    <div className="absolute inset-0 overflow-y-auto">
      <div className="sticky top-0 z-10 px-8 py-3" style={{ background: "rgba(5,5,5,0.78)", borderBottom: "0.5px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-baseline justify-between max-w-[760px] mx-auto">
          <span className="font-mono text-[10px] tracking-[0.32em] uppercase text-text-3">Timeline</span>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-text-4">{buckets.length} months</span>
        </div>
      </div>

      <div className="max-w-[760px] mx-auto px-8 pt-10 pb-16">
        {buckets.map(([month, items]) => {
          const [y, mo] = month.split("-");
          const monthLabel = `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y}`;
          return (
            <section key={month} className="mb-12">
              <div className="flex items-baseline gap-3 mb-5" style={{ borderBottom: "0.5px solid rgba(255,255,255,0.08)", paddingBottom: "10px" }}>
                <h2 className="text-text-1 text-[20px] font-medium" style={{ letterSpacing: "-0.02em" }}>{monthLabel}</h2>
                <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-text-4">{items.length} memories</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map(m => {
                  const proj = m.is_project && m.project_id ? projectsById[m.project_id] : null;
                  const date = new Date(m.created_at);
                  return (
                    <button key={m.id} onClick={() => select(m)} className="mem-card text-left">
                      <div className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-text-4 mb-1.5">
                        {String(date.getDate()).padStart(2, "0")} · {proj?.name ?? (m.is_project ? "project" : `life · ${m.life_area ?? "other"}`)} · {m.type}
                      </div>
                      <div className="text-[13px] text-text-1 font-medium leading-snug">
                        {m.summary || m.content.slice(0, 90)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        {buckets.length === 0 && (
          <div className="text-center py-24 text-text-3 text-[13px]">No memories yet.</div>
        )}
      </div>

      <MemoryDrawer />
    </div>
  );
}
