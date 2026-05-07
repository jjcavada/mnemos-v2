"use client";
import { useMemoriesStore } from "@/store/memories";
import { useMemo } from "react";
import { DailyBrief } from "./DailyBrief";
import { LIFE_GREY } from "@/lib/colors";

export function Sidebar() {
  const { memories, lifeAreas, projectsById, filters, toggleFilter, clearFilter, toggleSpace } = useMemoriesStore();

  const counts = useMemo(() => {
    const lifeAreaCounts: Record<string, number> = {};
    const projectCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};
    let lifeTotal = 0, projectTotal = 0;

    memories.forEach(m => {
      if (m.is_project) {
        projectTotal++;
        if (m.project_id) projectCounts[m.project_id] = (projectCounts[m.project_id] ?? 0) + 1;
      } else {
        lifeTotal++;
        if (m.life_area) lifeAreaCounts[m.life_area] = (lifeAreaCounts[m.life_area] ?? 0) + 1;
      }
      typeCounts[m.type] = (typeCounts[m.type] ?? 0) + 1;
      m.tags?.forEach(t => { tagCounts[t] = (tagCounts[t] ?? 0) + 1; });
    });

    const topTags = Object.entries(tagCounts).sort((a,b) => b[1]-a[1]).slice(0, 18);
    const sortedTypes = Object.entries(typeCounts).sort((a,b) => b[1]-a[1]);

    return { lifeAreaCounts, projectCounts, typeCounts: sortedTypes, tagCounts: topTags, lifeTotal, projectTotal };
  }, [memories]);

  return (
    <aside className="absolute top-[56px] left-0 bottom-0 w-[260px] bg-black/72 border-r border-cyan-300/15 z-10 overflow-y-auto px-3 py-4 backdrop-blur">
      {/* SPACES */}
      <div className="mb-5">
        <div className="h-section mb-2">Spaces</div>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => toggleSpace("life")}
            className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
              filters.showLife ? "bg-white/[0.06] text-text-1 border border-cyan-300/15" : "text-text-3 hover:bg-white/[0.04]"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: LIFE_GREY }} />
              Life
            </span>
            <span className="text-[10px] text-text-4">{counts.lifeTotal}</span>
          </button>
          <button
            onClick={() => toggleSpace("projects")}
            className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
              filters.showProjects ? "bg-white/[0.06] text-text-1 border border-cyan-300/15" : "text-text-3 hover:bg-white/[0.04]"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              Projects
            </span>
            <span className="text-[10px] text-text-4">{counts.projectTotal}</span>
          </button>
        </div>
      </div>

      {/* LIFE AREAS */}
      {filters.showLife && lifeAreas.length > 0 && (
        <Section title="Life Areas" onClear={() => clearFilter("lifeAreas")} hasActive={filters.lifeAreas.size > 0}>
          {lifeAreas.map(la => {
            const active = filters.lifeAreas.has(la.slug);
            const count = counts.lifeAreaCounts[la.slug] ?? 0;
            return (
              <button
                key={la.slug}
                onClick={() => toggleFilter("lifeAreas", la.slug)}
                className={`pill ${active ? "active" : ""}`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: LIFE_GREY }} />
                {la.name}
                <span className="text-[10px] opacity-60 ml-0.5">{count}</span>
              </button>
            );
          })}
        </Section>
      )}

      {/* PROJECTS */}
      {filters.showProjects && Object.keys(projectsById).length > 0 && (
        <Section title="Projects" onClear={() => clearFilter("projects")} hasActive={filters.projects.size > 0}>
          {Object.values(projectsById).map(p => {
            const active = filters.projects.has(p.id);
            const count = counts.projectCounts[p.id] ?? 0;
            if (count === 0) return null;
            return (
              <button
                key={p.id}
                onClick={() => toggleFilter("projects", p.id)}
                className={`pill ${active ? "active" : ""}`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                {p.name}
                <span className="text-[10px] opacity-60 ml-0.5">{count}</span>
              </button>
            );
          })}
        </Section>
      )}

      {/* TYPES */}
      <Section title="Types" onClear={() => clearFilter("types")} hasActive={filters.types.size > 0}>
        {counts.typeCounts.map(([t, c]) => (
          <button
            key={t}
            onClick={() => toggleFilter("types", t)}
            className={`pill ${filters.types.has(t) ? "active" : ""}`}
          >
            {t}
            <span className="text-[10px] opacity-60 ml-0.5">{c}</span>
          </button>
        ))}
      </Section>

      {/* TOP TAGS */}
      <Section title="Top Tags" onClear={() => clearFilter("tags")} hasActive={filters.tags.size > 0}>
        {counts.tagCounts.map(([t, c]) => (
          <button
            key={t}
            onClick={() => toggleFilter("tags", t)}
            className={`pill ${filters.tags.has(t) ? "active" : ""}`}
          >
            {t}
            <span className="text-[10px] opacity-60 ml-0.5">{c}</span>
          </button>
        ))}
      </Section>

      <DailyBrief />
    </aside>
  );
}

function Section({ title, onClear, hasActive, children }: {
  title: string; onClear: () => void; hasActive: boolean; children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <div className="h-section">{title}</div>
        {hasActive && (
          <button onClick={onClear} className="text-[10px] text-text-4 hover:text-text-2">CLEAR</button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
