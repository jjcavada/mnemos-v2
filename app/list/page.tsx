"use client";
import { useMemo } from "react";
import { useMemoriesStore, applyFilters } from "@/store/memories";
import { MemoryDrawer } from "@/components/MemoryDrawer";

export default function ListPage() {
  const { memories, projectsById, select } = useMemoriesStore();
  const list = useMemo(() => applyFilters(memories), [memories]);

  return (
    <div className="absolute inset-0 overflow-y-auto">
      {/* tiny corner header */}
      <div className="sticky top-0 z-10 px-8 py-3" style={{ background: "rgba(5,5,5,0.78)", borderBottom: "0.5px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-baseline justify-between max-w-[640px] mx-auto">
          <span className="font-mono text-[10px] tracking-[0.32em] uppercase text-text-3">List · Read</span>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-text-4">{list.length} memories</span>
        </div>
      </div>

      {/* obsidian-style narrow column reader */}
      <article className="max-w-[640px] mx-auto px-8 py-12">
        {list.map((m, i) => {
          const proj = m.is_project && m.project_id ? projectsById[m.project_id] : null;
          const tagText = (m.tags ?? []).slice(0, 4).join(" · ");
          return (
            <button
              key={m.id}
              onClick={() => select(m)}
              className="w-full text-left block py-7 transition-colors hover:bg-white/[0.015]"
              style={{ borderTop: i === 0 ? "none" : "0.5px solid rgba(255,255,255,0.06)" }}
            >
              {/* meta line */}
              <div className="flex items-center gap-2 mb-2 font-mono text-[10px] tracking-[0.16em] uppercase text-text-4">
                <span>{new Date(m.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })}</span>
                <span>·</span>
                <span className="text-text-3">{proj?.name ?? (m.is_project ? "project" : `life · ${m.life_area ?? "other"}`)}</span>
                <span>·</span>
                <span>{m.type}</span>
              </div>

              {/* summary as headline */}
              {m.summary && (
                <h2 className="text-[18px] leading-snug text-text-1 font-medium mb-3" style={{ letterSpacing: "-0.01em" }}>
                  {m.summary}
                </h2>
              )}

              {/* body */}
              <div className="text-[14px] leading-relaxed text-text-2 whitespace-pre-wrap" style={{ letterSpacing: "0.001em" }}>
                {m.content.length > 600 ? `${m.content.slice(0, 600)}…` : m.content}
              </div>

              {/* tag line */}
              {tagText && (
                <div className="mt-3 font-mono text-[10px] tracking-[0.12em] text-text-4">
                  {tagText}
                </div>
              )}
            </button>
          );
        })}

        {list.length === 0 && (
          <div className="text-center py-24 text-text-3 text-[13px]">No memories.</div>
        )}
      </article>

      <MemoryDrawer />
    </div>
  );
}
