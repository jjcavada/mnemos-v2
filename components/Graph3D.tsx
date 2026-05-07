"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMemoriesStore, applyFilters } from "@/store/memories";
import { memoryColor, RELATION_EDGE_COLORS } from "@/lib/colors";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

export function Graph3D() {
  const { memories, relationships, projectsById, select, filters } = useMemoriesStore();
  const ref = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const data = useMemo(() => {
    const filtered = applyFilters(memories);
    const ids = new Set(filtered.map(m => m.id));
    const links = relationships
      .filter(r => ids.has(r.from_memory) && ids.has(r.to_memory))
      .map(r => ({ source: r.from_memory, target: r.to_memory, relation: r.relation_type }));
    const nodes = filtered.map(m => ({
      id: m.id,
      label: m.summary || m.content.slice(0, 60),
      color: memoryColor(m, projectsById),
      val: m.tags?.length ? m.tags.length + 1 : 1,
      mem: m
    }));
    return { nodes, links };
  }, [memories, relationships, projectsById, filters]);

  return (
    <div ref={wrapperRef} className="absolute inset-0">
      <ForceGraph3D
        ref={ref as any}
        width={size.w || undefined}
        height={size.h || undefined}
        graphData={data}
        backgroundColor="#020407"
        nodeColor={(n: any) => n.color}
        nodeLabel={(n: any) => n.label}
        nodeOpacity={0.96}
        linkColor={(l: any) => RELATION_EDGE_COLORS[l.relation] ?? "rgba(125,211,252,0.45)"}
        linkOpacity={0.62}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1.6}
        warmupTicks={140}
        cooldownTicks={400}
        cooldownTime={15000}
        d3VelocityDecay={0.32}
        d3AlphaDecay={0.018}
        enableNodeDrag={true}
        onNodeDrag={(n: any) => {
          n.fx = n.x; n.fy = n.y; n.fz = n.z;
        }}
        onNodeDragEnd={(n: any) => {
          n.fx = n.x; n.fy = n.y; n.fz = n.z;
        }}
        onNodeClick={(n: any) => {
          const dist = 80;
          const distRatio = 1 + dist / Math.hypot(n.x, n.y, n.z);
          ref.current?.cameraPosition({ x: n.x * distRatio, y: n.y * distRatio, z: n.z * distRatio }, n, 1200);
          select(n.mem);
        }}
        onNodeRightClick={(n: any) => {
          n.fx = null; n.fy = null; n.fz = null;
        }}
      />
    </div>
  );
}
