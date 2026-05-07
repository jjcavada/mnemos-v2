"use client";
import { useMemo } from "react";
import { X } from "lucide-react";
import { useMemoriesStore } from "@/store/memories";

export function FilterPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
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

    return {
      lifeAreaCounts,
      projectCounts,
      typeCounts: Object.entries(typeCounts).sort((a, b) => b[1] - a[1]),
      tagCounts: Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 18),
      lifeTotal,
      projectTotal
    };
  }, [memories]);

  if (!open) return null;

  return (
    <aside
      className="absolute top-0 left-[40px] bottom-0 w-[260px] z-20 overflow-y-auto p-4 spring-in"
      style={{ background: "rgba(12, 12, 12, 0.78)", borderRight: "0.5px solid rgba(255,255,255,0.06)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)" }}
    >
      <div className="flex items-center justify-between mb-5">
        <span className="h-micro">Filters</span>
        <button onClick={onClose} className="text-text-3 hover:text-text-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Spaces */}
      <Section title="Spaces">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => toggleSpace("life")}
            className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
              filters.showLife ? "text-text-1" : "text-text-3"
            }`}
            style={filters.showLife ? { background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)" } : { border: "0.5px solid transparent" }}
          >
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-text-3" />
              Life
            </span>
            <span className="font-mono text-[10px] text-text-4">{counts.lifeTotal}</span>
          </button>
          <button
            onClick={() => toggleSpace("projects")}
            className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
              filters.showProjects ? "text-text-1" : "text-text-3"
            }`}
            style={filters.showProjects ? { background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)" } : { border: "0.5px solid transparent" }}
          >
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-text-1" />
              Projects
            </span>
            <span className="font-mono text-[10px] text-text-4">{counts.projectTotal}</span>
          </button>
        </div>
      </Section>

      {filters.showLife && lifeAreas.length > 0 && (
        <Section title="Life areas" onClear={() => clearFilter("lifeAreas")} hasActive={filters.lifeAreas.size > 0}>
          <div className="flex flex-wrap gap-1.5">
            {lifeAreas.map(la => {
              const active = filters.lifeAreas.has(la.slug);
              const count = counts.lifeAreaCounts[la.slug] ?? 0;
              return (
                <button
                  key={la.slug}
                  onClick={() => toggleFilter("lifeAreas", la.slug)}
                  className={`pill ${active ? "active" : ""}`}
                >
                  {la.name}
                  <span className="text-[10px] opacity-60 ml-0.5">{count}</span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {filters.showProjects && Object.keys(projectsById).length > 0 && (
        <Section title="Projects" onClear={() => clearFilter("projects")} hasActive={filters.projects.size > 0}>
          <div className="flex flex-wrap gap-1.5">
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
                  {p.name}
                  <span className="text-[10px] opacity-60 ml-0.5">{count}</span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Types" onClear={() => clearFilter("types")} hasActive={filters.types.size > 0}>
        <div className="flex flex-wrap gap-1.5">
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
        </div>
      </Section>

      <Section title="Tags" onClear={() => clearFilter("tags")} hasActive={filters.tags.size > 0}>
        <div className="flex flex-wrap gap-1.5">
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
        </div>
      </Section>
    </aside>
  );
}

function Section({ title, onClear, hasActive, children }: {
  title: string; onClear?: () => void; hasActive?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2.5">
        <span className="h-micro">{title}</span>
        {hasActive && onClear && (
          <button onClick={onClear} className="text-[9.5px] text-text-4 hover:text-text-2 tracking-wider uppercase">Clear</button>
        )}
      </div>
      {children}
    </div>
  );
}
