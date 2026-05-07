"use client";
import dynamic from "next/dynamic";
import { useMemo, useRef } from "react";
import { useMemoriesStore, applyFilters } from "@/store/memories";
import { memoryColor, RELATION_EDGE_COLORS } from "@/lib/colors";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

export function Graph3D() {
  const { memories, relationships, projectsById, select, filters } = useMemoriesStore();
  const ref = useRef<any>(null);

  const data = useMemo(() => {
    const filtered = applyFilters(memories);
    const ids = new Set(filtered.map(m => m.id));
    const links = relationships
      .filter(r => ids.has(r.from_memory) && ids.has(r.to_memory))
      .map(r => ({ source: r.from_memory, target: r.to_memory, relation: r.relation_type }));
    const nodes = filtered.map(m => ({
      id: m.id, label: m.summary || m.content.slice(0, 60),
      color: memoryColor(m, projectsById), val: m.tags?.length ? m.tags.length + 1 : 1, mem: m
    }));
    return { nodes, links };
  }, [memories, relationships, projectsById, filters]);

  return (
    <div className="absolute inset-0">
      <ForceGraph3D
        ref={ref as any}
        graphData={data}
        backgroundColor="#020407"
        nodeColor={(n: any) => n.color}
        nodeLabel={(n: any) => n.label}
        linkColor={(l: any) => RELATION_EDGE_COLORS[l.relation] ?? "rgba(125,211,252,0.45)"}
        linkOpacity={0.62}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1.6}
        nodeOpacity={0.96}
        onNodeClick={(n: any) => {
          const dist = 80;
          const distRatio = 1 + dist / Math.hypot(n.x, n.y, n.z);
          ref.current?.cameraPosition({ x: n.x * distRatio, y: n.y * distRatio, z: n.z * distRatio }, n, 1200);
          select(n.mem);
        }}
      />
    </div>
  );
}
