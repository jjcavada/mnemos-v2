"use client";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { Activity, BrainCircuit, Gauge, Network, Radio, Sparkles } from "lucide-react";
import { applyFilters, useMemoriesStore } from "@/store/memories";
import { memoryColor } from "@/lib/colors";

export function GraphCommandDeck() {
  const { memories, relationships, projectsById } = useMemoriesStore();

  const stats = useMemo(() => {
    const filtered = applyFilters(memories);
    const filteredIds = new Set(filtered.map(m => m.id));
    const visibleLinks = relationships.filter(r => filteredIds.has(r.from_memory) && filteredIds.has(r.to_memory));
    const projectCount = filtered.filter(m => m.is_project).length;
    const lifeCount = filtered.length - projectCount;
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = filtered.filter(m => m.created_at?.startsWith(today)).length;
    const highSignal = filtered.filter(m => (m.importance_score ?? 0) >= 0.9).length;

    const projectRows = Object.values(projectsById)
      .map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        count: filtered.filter(m => m.project_id === p.id).length
      }))
      .filter(p => p.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const recent = filtered
      .slice()
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .slice(0, 5);

    const tagCounts: Record<string, number> = {};
    filtered.forEach(m => (m.tags ?? []).forEach(t => { tagCounts[t] = (tagCounts[t] ?? 0) + 1; }));
    const tags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 7);

    return { filtered, visibleLinks, projectCount, lifeCount, todayCount, highSignal, projectRows, recent, tags };
  }, [memories, relationships, projectsById]);

  const density = stats.filtered.length ? Math.round((stats.visibleLinks.length / stats.filtered.length) * 100) : 0;

  return (
    <>
      <div className="graph-titleplate pointer-events-none">
        <div className="font-mono text-[10px] tracking-[0.42em] text-cyan-100">MNEMOS / GRAPH OPS</div>
        <div className="mt-2 text-[11px] text-text-3">hybrid memory topology - live corpus</div>
      </div>

      <div className="absolute left-5 top-6 z-10 w-[170px] space-y-3 pointer-events-none">
        <Telemetry icon={<BrainCircuit />} label="nodes" value={stats.filtered.length} accent="text-cyan-200" />
        <Telemetry icon={<Network />} label="links" value={stats.visibleLinks.length} accent="text-violet-200" />
        <Telemetry icon={<Gauge />} label="density" value={`${density}%`} accent="text-amber-200" />
        <Telemetry icon={<Activity />} label="today" value={stats.todayCount} accent="text-emerald-200" />
      </div>

      <aside className="absolute right-5 top-5 bottom-5 z-10 w-[310px] pointer-events-auto space-y-3 overflow-hidden">
        <Panel title="Signal Mix" icon={<Radio className="w-3.5 h-3.5" />}>
          <div className="grid grid-cols-2 gap-2">
            <MiniMetric label="Projects" value={stats.projectCount} />
            <MiniMetric label="Life" value={stats.lifeCount} />
            <MiniMetric label="High Signal" value={stats.highSignal} />
            <MiniMetric label="Visible Links" value={stats.visibleLinks.length} />
          </div>
        </Panel>

        <Panel title="Project Clusters" icon={<Network className="w-3.5 h-3.5" />}>
          <div className="space-y-2">
            {stats.projectRows.map(p => (
              <div key={p.id} className="data-row">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                  <span className="truncate">{p.name}</span>
                </span>
                <span className="font-mono text-cyan-100">{p.count}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Recent Trace" icon={<Sparkles className="w-3.5 h-3.5" />}>
          <div className="space-y-2">
            {stats.recent.map(m => (
              <div key={m.id} className="border-l pl-2" style={{ borderColor: memoryColor(m, projectsById) }}>
                <div className="text-[11px] text-text-2 leading-snug line-clamp-2">{m.summary || m.content.slice(0, 86)}</div>
                <div className="mt-1 font-mono text-[9px] text-text-4">{m.type} / {new Date(m.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Dominant Tags" icon={<Activity className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {stats.tags.map(([tag, count]) => (
              <span key={tag} className="hud-chip">{tag}<span>{count}</span></span>
            ))}
          </div>
        </Panel>
      </aside>

      <div className="absolute left-5 right-[340px] bottom-5 z-10 pointer-events-none">
        <div className="hud-panel px-4 py-3">
          <div className="flex items-end gap-2 h-10">
            {stats.recent.map((m, i) => {
              const h = 24 + ((m.importance_score ?? 0.5) * 38);
              return (
                <div key={m.id} className="flex-1">
                  <div className="bg-cyan-200/70 border border-cyan-100/60" style={{ height: `${h}%` }} />
                  <div className="mt-1 h-px bg-white/10" />
                </div>
              );
            })}
            {stats.recent.length === 0 && <div className="text-[11px] text-text-4">No recent trace</div>}
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[9px] text-text-4 uppercase tracking-wider">
            <span>retrieval pulse</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </>
  );
}

function Telemetry({ icon, label, value, accent }: {
  icon: ReactNode;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="hud-panel px-3 py-2">
      <div className="flex items-center justify-between">
        <div className={`w-4 h-4 ${accent}`}>{icon}</div>
        <div className="font-mono text-[10px] text-text-4 uppercase">{label}</div>
      </div>
      <div className={`mt-1 font-mono text-2xl ${accent}`}>{value}</div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="hud-panel p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-cyan-200">{icon}</span>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-3">{title}</div>
      </div>
      {children}
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-white/10 bg-white/[0.03] rounded px-2 py-2">
      <div className="font-mono text-[9px] uppercase text-text-4">{label}</div>
      <div className="font-mono text-lg text-cyan-100">{value}</div>
    </div>
  );
}
