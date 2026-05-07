"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMemoriesStore, applyFilters } from "@/store/memories";
import { memoryColor, RELATION_EDGE_COLORS, ANIMATED_RELATIONS } from "@/lib/colors";
import type { Memory } from "@/lib/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type Node = {
  id: string;
  label: string;
  color: string;
  size: number;
  x: number;
  y: number;
  fx?: number;
  fy?: number;
  mem: Memory;
};
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
      connCount[l.source] = (connCount[l.source] ?? 0) + 1;
      connCount[l.target] = (connCount[l.target] ?? 0) + 1;
    });

    const clusterKey = (m: Memory) => m.is_project
      ? `project:${m.project_id ?? "unknown"}`
      : `life:${m.life_area ?? "life"}`;
    const clusters = Array.from(new Set(filtered.map(clusterKey))).sort();
    const clusterIndex = new Map(clusters.map((key, index) => [key, index]));
    const clusterCounts = filtered.reduce<Record<string, number>>((acc, m) => {
      const key = clusterKey(m);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const clusterSeen: Record<string, number> = {};

    const nodes: Node[] = filtered.map((m, absoluteIndex) => {
      const key = clusterKey(m);
      const seen = clusterSeen[key] ?? 0;
      clusterSeen[key] = seen + 1;
      const count = clusterCounts[key] ?? 1;
      const clusterAngle = ((clusterIndex.get(key) ?? 0) / Math.max(clusters.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const clusterRadius = clusters.length > 1 ? 145 : 0;
      const clusterX = Math.cos(clusterAngle) * clusterRadius;
      const clusterY = Math.sin(clusterAngle) * clusterRadius;
      const localAngle = (seen / count) * Math.PI * 2 + (absoluteIndex % 3) * 0.18;
      const localRadius = 22 + Math.sqrt(count) * 5 + (seen % 5) * 4;
      const x = clusterX + Math.cos(localAngle) * localRadius;
      const y = clusterY + Math.sin(localAngle) * localRadius;

      return {
        id: m.id,
        label: m.summary || m.content.slice(0, 60),
        color: memoryColor(m, projectsById),
        size: 4 + Math.sqrt(connCount[m.id] ?? 0) * 1.35 + (m.importance_score ?? 0.5),
        x,
        y,
        mem: m
      };
    });
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

  function fitGraph(duration = 700) {
    const fg = fgRef.current;
    if (!fg) return;
    fg.zoomToFit(duration, 155);
    window.setTimeout(() => fg.centerAt(65, 0, Math.min(duration, 500)), duration + 30);
  }

  useEffect(() => {
    const t = setTimeout(() => fitGraph(900), 700);
    return () => clearTimeout(t);
  }, [data]);

  return (
    <div className="absolute inset-0">
      <ForceGraph2D
        ref={fgRef as any}
        graphData={data}
        backgroundColor="#020407"
        nodeRelSize={1}
        warmupTicks={140}
        cooldownTicks={400}
        cooldownTime={15000}
        d3VelocityDecay={0.32}
        d3AlphaDecay={0.018}
        enableNodeDrag={true}
        onNodeDrag={(node: any) => {
          node.fx = node.x;
          node.fy = node.y;
        }}
        onNodeDragEnd={(node: any) => {
          node.fx = node.x;
          node.fy = node.y;
        }}
        onEngineStop={() => fitGraph(500)}
        linkColor={(l: any) => {
          const focus = selectedId ?? hovered;
          if (!focus) return "rgba(125,211,252,0.34)";
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          if (sId === focus || tId === focus) return RELATION_EDGE_COLORS[l.relation] ?? "#a8a8b1";
          return "rgba(70,80,95,0.09)";
        }}
        linkWidth={(l: any) => {
          const focus = selectedId ?? hovered;
          if (!focus) return 1;
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          return (sId === focus || tId === focus) ? 1.9 : 0.45;
        }}
        linkDirectionalParticles={(l: any) => {
          const focus = selectedId ?? hovered;
          if (!focus) return ANIMATED_RELATIONS.has(l.relation) ? 1 : 0;
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          if ((sId === focus || tId === focus) && ANIMATED_RELATIONS.has(l.relation)) return 4;
          return 0;
        }}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={1.8}
        linkDirectionalParticleColor={(l: any) => RELATION_EDGE_COLORS[l.relation] ?? "#67e8f9"}
        onRenderFramePre={(ctx: CanvasRenderingContext2D, scale: number) => {
          const w = ctx.canvas.width;
          const h = ctx.canvas.height;
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.strokeStyle = "rgba(125,211,252,0.05)";
          ctx.lineWidth = 1;
          for (let r = 160; r < Math.max(w, h); r += 170) {
            ctx.beginPath();
            ctx.arc(w * 0.48, h * 0.54, r, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          for (let i = 0; i < 80; i++) {
            const x = (i * 97) % w;
            const y = (i * 193) % h;
            ctx.globalAlpha = 0.08 + ((i % 7) / 35);
            ctx.fillRect(x, y, 1, 1);
          }
          ctx.restore();
        }}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
          const r = node.size;
          const focus = focusOf(node.id);
          const dimmed = focus === "dim";
          const isSelected = focus === "selected" && selectedId === node.id;

          ctx.save();
          ctx.globalAlpha = dimmed ? 0.16 : 1;

          ctx.globalCompositeOperation = "lighter";
          const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * (isSelected ? 9 : 5));
          glow.addColorStop(0, `${node.color}77`);
          glow.addColorStop(0.35, `${node.color}22`);
          glow.addColorStop(1, `${node.color}00`);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * (isSelected ? 9 : 5), 0, 2 * Math.PI);
          ctx.fill();

          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = isSelected ? "#ffffff" : `${node.color}cc`;
          ctx.lineWidth = (isSelected ? 1.7 : 0.7) / scale;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * (isSelected ? 2.4 : 1.8), 0, 2 * Math.PI);
          ctx.stroke();

          ctx.fillStyle = isSelected ? "#ffffff" : dimmed ? "#3a3a43" : node.color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fill();

          if (focus === "neighbor" || isSelected) {
            ctx.strokeStyle = isSelected ? "#fef3c7" : node.color;
            ctx.lineWidth = 1.2 / scale;
            ctx.beginPath();
            ctx.moveTo(node.x - r * 2.6, node.y);
            ctx.lineTo(node.x - r * 1.3, node.y);
            ctx.moveTo(node.x + r * 1.3, node.y);
            ctx.lineTo(node.x + r * 2.6, node.y);
            ctx.moveTo(node.x, node.y - r * 2.6);
            ctx.lineTo(node.x, node.y - r * 1.3);
            ctx.moveTo(node.x, node.y + r * 1.3);
            ctx.lineTo(node.x, node.y + r * 2.6);
            ctx.stroke();
          }

          const showLabel = isSelected || focus === "neighbor" || hovered === node.id || scale > 2.35;
          if (showLabel) {
            const fontSize = isSelected ? Math.max(13 / scale, 4) : Math.max(10 / scale, 3);
            ctx.font = `${isSelected ? "700" : "600"} ${fontSize}px JetBrains Mono, Inter, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = isSelected ? "#ffffff" : "rgba(207,250,254,0.78)";
            const label = node.label.length > 42 ? `${node.label.slice(0, 42)}...` : node.label;
            ctx.fillText(label, node.x, node.y + r + 5);
          }

          ctx.restore();
        }}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, Math.max(node.size, 8), 0, 2 * Math.PI);
          ctx.fill();
        }}
        onNodeClick={(n: any) => {
          setSelectedId(n.id);
          fgRef.current?.centerAt(n.x, n.y, 700);
          fgRef.current?.zoom(Math.max(fgRef.current?.zoom() ?? 1, 2.4), 700);
          select(n.mem);
        }}
        onNodeRightClick={(n: any) => {
          n.fx = null;
          n.fy = null;
        }}
        onNodeHover={(n: any) => setHovered(n?.id ?? null)}
        onBackgroundClick={() => { setSelectedId(null); fitGraph(700); }}
        onBackgroundRightClick={() => fitGraph(700)}
      />
    </div>
  );
}
