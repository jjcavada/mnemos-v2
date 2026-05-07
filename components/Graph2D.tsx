"use client";
import dynamic from "next/dynamic";
import { useMemo, useRef, useEffect, useState } from "react";
import { useMemoriesStore, applyFilters } from "@/store/memories";
import { memoryColor, RELATION_EDGE_COLORS, ANIMATED_RELATIONS } from "@/lib/colors";
import type { Memory } from "@/lib/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type Node = { id: string; label: string; color: string; size: number; mem: Memory };
type Link = { source: string; target: string; relation: string };

export function Graph2D() {
  const { memories, relationships, projectsById, select, filters } = useMemoriesStore();
  const fgRef = useRef<any>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const data = useMemo(() => {
    const filtered = applyFilters(memories);
    const ids = new Set(filtered.map(m => m.id));
    const links = relationships
      .filter(r => ids.has(r.from_memory) && ids.has(r.to_memory))
      .map(r => ({ source: r.from_memory, target: r.to_memory, relation: r.relation_type }));

    const connCount: Record<string, number> = {};
    links.forEach(l => {
      connCount[l.source as string] = (connCount[l.source as string] ?? 0) + 1;
      connCount[l.target as string] = (connCount[l.target as string] ?? 0) + 1;
    });

    const nodes: Node[] = filtered.map(m => ({
      id: m.id,
      label: m.summary || m.content.slice(0, 60),
      color: memoryColor(m, projectsById),
      size: 2.8 + Math.sqrt(connCount[m.id] ?? 0) * 1.0,
      mem: m
    }));
    return { nodes, links };
  }, [memories, relationships, projectsById, filters]);

  const neighborMap = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    data.links.forEach(l => {
      const s = typeof l.source === "object" ? (l.source as any).id : l.source;
      const t = typeof l.target === "object" ? (l.target as any).id : l.target;
      (m[s] ||= new Set()).add(t);
      (m[t] ||= new Set()).add(s);
    });
    return m;
  }, [data]);

  function focusOf(id: string): "selected" | "neighbor" | "dim" | "normal" {
    const focus = selectedId ?? hovered;
    if (!focus) return "normal";
    if (id === focus) return "selected";
    if (neighborMap[focus]?.has(id)) return "neighbor";
    return "dim";
  }

  useEffect(() => {
    const t = setTimeout(() => fgRef.current?.zoomToFit(800, 80), 800);
    return () => clearTimeout(t);
  }, [data]);

  return (
    <div className="absolute inset-0">
      <ForceGraph2D
        ref={fgRef as any}
        graphData={data}
        backgroundColor="#08080a"
        nodeRelSize={1}
        linkColor={(l: any) => {
          const focus = selectedId ?? hovered;
          if (!focus) return "rgba(74,74,82,0.35)";
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          if (sId === focus || tId === focus) return RELATION_EDGE_COLORS[l.relation] ?? "#a8a8b1";
          return "rgba(58,58,67,0.10)";
        }}
        linkWidth={(l: any) => {
          const focus = selectedId ?? hovered;
          if (!focus) return 0.7;
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          return (sId === focus || tId === focus) ? 1.6 : 0.7;
        }}
        linkDirectionalParticles={(l: any) => {
          const focus = selectedId ?? hovered;
          if (!focus) return 0;
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          if ((sId === focus || tId === focus) && ANIMATED_RELATIONS.has(l.relation)) return 3;
          return 0;
        }}
        linkDirectionalParticleSpeed={0.006}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={(l: any) => RELATION_EDGE_COLORS[l.relation] ?? "#818cf8"}
        nodeCanvasObject={(node: any, ctx, scale) => {
          const r = node.size;
          const focus = focusOf(node.id);
          const dimmed = focus === "dim";
          ctx.globalAlpha = dimmed ? 0.18 : 1;

          if (focus === "selected" && selectedId === node.id) {
            const grad = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, r * 5);
            grad.addColorStop(0, node.color + "55");
            grad.addColorStop(1, node.color + "00");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 5, 0, 2 * Math.PI);
            ctx.fill();
          }

          ctx.fillStyle = focus === "selected" && selectedId === node.id ? "#ffffff" : (dimmed ? "#3a3a43" : node.color);
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fill();

          if (focus === "neighbor") {
            ctx.strokeStyle = node.color;
            ctx.lineWidth = 1.2 / scale;
            ctx.stroke();
          }

          ctx.globalAlpha = 1;

          const showLabel = focus === "selected" || focus === "neighbor" || hovered === node.id || scale > 2.2;
          if (showLabel) {
            const isSel = focus === "selected" && selectedId === node.id;
            const fontSize = isSel ? Math.max(13 / scale, 4) : Math.max(10 / scale, 3);
            ctx.font = (isSel ? "600 " : "500 ") + fontSize + "px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = isSel ? "#ffffff" : focus === "neighbor" ? "#e5e5e5" : "rgba(168,168,177,0.7)";
            const label = node.label.length > 38 ? node.label.slice(0, 38) + "…" : node.label;
            ctx.fillText(label, node.x, node.y + r + 3);
          }
        }}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, Math.max(node.size, 6), 0, 2 * Math.PI);
          ctx.fill();
        }}
        onNodeClick={(n: any) => {
          setSelectedId(n.id);
          fgRef.current?.centerAt(n.x, n.y, 600);
          fgRef.current?.zoom(Math.max(fgRef.current?.zoom() ?? 1, 2.2), 600);
          select(n.mem);
        }}
        onNodeHover={(n: any) => setHovered(n?.id ?? null)}
        onBackgroundClick={() => { setSelectedId(null); fgRef.current?.zoomToFit(600, 80); }}
      />
    </div>
  );
}
