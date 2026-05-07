"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMemoriesStore, applyFilters } from "@/store/memories";
import type { Memory } from "@/lib/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type Node = {
  id: string;
  label: string;
  size: number;
  isRoot: boolean;
  groupKey: string;
  x: number;
  y: number;
  fx?: number;
  fy?: number;
  mem: Memory;
};

export function Graph2D() {
  const { memories, relationships, projectsById, select, selected, filters } = useMemoriesStore();
  const fgRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
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

    const adj: Record<string, Set<string>> = {};
    for (const l of links) {
      (adj[l.source] ||= new Set()).add(l.target);
      (adj[l.target] ||= new Set()).add(l.source);
    }

    let root: Memory | null = null;
    if (filtered.length > 0) {
      root = filtered[0];
      for (const m of filtered) {
        const dg = adj[m.id]?.size ?? 0;
        const rdg = root ? (adj[root.id]?.size ?? 0) : -1;
        if (dg > rdg || (dg === rdg && (m.importance_score ?? 0) > (root?.importance_score ?? 0))) {
          root = m;
        }
      }
    }

    const groupKeyOf = (m: Memory) =>
      m.is_project ? `p:${m.project_id ?? "unset"}` : `l:${m.life_area ?? "other"}`;

    const rootGroupKey = root ? groupKeyOf(root) : null;
    const groupKeys = Array.from(new Set(filtered.map(groupKeyOf)));
    const otherGroups = groupKeys.filter(k => k !== rootGroupKey);

    // group seeds — radial around root
    const SATELLITE_RADIUS = 320;
    const groupCenter: Record<string, { gx: number; gy: number }> = {};
    if (rootGroupKey) groupCenter[rootGroupKey] = { gx: 0, gy: 0 };
    otherGroups.forEach((gk, i) => {
      const angle = (i / Math.max(otherGroups.length, 1)) * Math.PI * 2 - Math.PI / 2;
      groupCenter[gk] = {
        gx: Math.cos(angle) * SATELLITE_RADIUS,
        gy: Math.sin(angle) * SATELLITE_RADIUS
      };
    });

    const groupBuckets: Record<string, string[]> = {};
    filtered.forEach(m => { (groupBuckets[groupKeyOf(m)] ||= []).push(m.id); });
    const groupIdx: Record<string, number> = {};
    Object.values(groupBuckets).forEach(b => b.forEach((id, i) => { groupIdx[id] = i; }));

    const connCount: Record<string, number> = {};
    links.forEach(l => {
      connCount[l.source] = (connCount[l.source] ?? 0) + 1;
      connCount[l.target] = (connCount[l.target] ?? 0) + 1;
    });

    const nodes: Node[] = filtered.map(m => {
      const gk = groupKeyOf(m);
      const center = groupCenter[gk] ?? { gx: 0, gy: 0 };
      const bucket = groupBuckets[gk];
      const idx = groupIdx[m.id];
      const angle = bucket.length === 1 ? 0 : (idx / bucket.length) * Math.PI * 2;
      const isRoot = root !== null && m.id === root.id;
      const localR = 55 + (idx % 4) * 8;
      const x = isRoot ? 0 : center.gx + Math.cos(angle) * localR;
      const y = isRoot ? 0 : center.gy + Math.sin(angle) * localR;
      return {
        id: m.id,
        label: m.summary || m.content.slice(0, 60),
        size: (isRoot ? 4.5 : 2.6) + Math.sqrt(connCount[m.id] ?? 0) * 0.55,
        isRoot,
        groupKey: gk,
        x,
        y,
        fx: isRoot ? 0 : undefined,
        fy: isRoot ? 0 : undefined,
        mem: m
      };
    });

    return { nodes, links, rootId: root?.id ?? null, groupCenter };
  }, [memories, relationships, projectsById, filters]);

  const graphData = useMemo(() => ({ nodes: data.nodes, links: data.links }), [data]);

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

  // physics: high repulsion, slow damping for organic movement; tight intra-cluster links, loose cross-cluster
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || data.nodes.length === 0) return;
    try {
      const charge = typeof fg.d3Force === "function" ? fg.d3Force("charge") : null;
      if (charge && typeof charge.strength === "function") {
        charge.strength(-220);
        if (typeof charge.distanceMax === "function") charge.distanceMax(360);
      }
      const link = typeof fg.d3Force === "function" ? fg.d3Force("link") : null;
      if (link) {
        const groupMap = new Map(data.nodes.map(n => [n.id, n.groupKey]));
        link.distance((l: any) => {
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          const sg = groupMap.get(sId);
          const tg = groupMap.get(tId);
          return sg && tg && sg === tg ? 30 : 220;
        });
        link.strength((l: any) => {
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          const sg = groupMap.get(sId);
          const tg = groupMap.get(tId);
          return sg && tg && sg === tg ? 0.55 : 0.04;
        });
      }
      if (typeof fg.d3Force === "function") fg.d3Force("center", null);
      const clusterPull = (alpha: number) => {
        const k = 0.18 * alpha;
        for (const n of data.nodes as any[]) {
          if (n.isRoot) continue;
          const gc = data.groupCenter[n.groupKey];
          if (!gc) continue;
          n.vx = (n.vx ?? 0) + (gc.gx - (n.x ?? 0)) * k;
          n.vy = (n.vy ?? 0) + (gc.gy - (n.y ?? 0)) * k;
        }
      };
      if (typeof fg.d3Force === "function") fg.d3Force("cluster", clusterPull);
      if (typeof fg.d3ReheatSimulation === "function") fg.d3ReheatSimulation();
    } catch (err) {
      console.warn("[Graph2D] force tuning skipped:", err);
    }
  }, [data]);

  function focusOf(id: string): "selected" | "neighbor" | "dim" | "normal" {
    const focus = selected?.id ?? hovered;
    if (!focus) return "normal";
    if (id === focus) return "selected";
    if (neighborMap[focus]?.has(id)) return "neighbor";
    return "dim";
  }

  function fitGraph(duration = 700) {
    const fg = fgRef.current;
    if (!fg) return;
    fg.zoomToFit(duration, 60);
  }

  useEffect(() => {
    const t = setTimeout(() => fitGraph(900), 800);
    return () => clearTimeout(t);
  }, [data]);

  return (
    <div ref={wrapperRef} className="absolute inset-0">
      <ForceGraph2D
        ref={fgRef as any}
        width={size.w || undefined}
        height={size.h || undefined}
        graphData={graphData}
        backgroundColor="#050505"
        nodeRelSize={1}
        warmupTicks={140}
        cooldownTicks={400}
        cooldownTime={15000}
        d3VelocityDecay={0.50}
        d3AlphaDecay={0.018}
        enableNodeDrag={true}
        onNodeDrag={(node: any) => { node.fx = node.x; node.fy = node.y; }}
        onNodeDragEnd={(node: any) => {
          if (node.isRoot) { node.fx = 0; node.fy = 0; return; }
          node.fx = node.x; node.fy = node.y;
        }}
        linkColor={(l: any) => {
          const focus = selected?.id ?? hovered;
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          if (focus && (sId === focus || tId === focus)) return "rgba(255,255,255,0.55)";
          return "rgba(255,255,255,0.10)";
        }}
        linkWidth={(l: any) => {
          const focus = selected?.id ?? hovered;
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          if (focus && (sId === focus || tId === focus)) return 1.0;
          return 0.4;
        }}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
          const r = node.size;
          const focus = focusOf(node.id);
          const dimmed = focus === "dim";
          const isSelected = focus === "selected";
          const isRoot = node.isRoot;

          ctx.save();
          ctx.globalAlpha = dimmed ? 0.18 : 1;

          // root: slightly larger, silver ring
          if (isRoot) {
            ctx.strokeStyle = "rgba(229,229,229,0.85)";
            ctx.lineWidth = 1.0 / scale;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 3.5, 0, Math.PI * 2);
            ctx.stroke();
          }

          // outer ring on selected
          if (isSelected) {
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.lineWidth = 1.2 / scale;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 4, 0, Math.PI * 2);
            ctx.stroke();
          }

          // node dot — pure white point
          ctx.fillStyle = isRoot
            ? "#FFFFFF"
            : isSelected
              ? "#FFFFFF"
              : focus === "neighbor"
                ? "rgba(255,255,255,0.95)"
                : "rgba(229,229,229,0.85)";
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fill();

          // label only when focused/hovered/root, with offset so it doesn't overlap node
          const showLabel = isRoot || isSelected || focus === "neighbor" || hovered === node.id;
          if (showLabel) {
            const fontSize = Math.max(10 / scale, 3.2);
            ctx.font = `500 ${fontSize}px Geist Sans, Inter, system-ui, sans-serif`;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            const labelX = node.x + r + 6;
            const labelY = node.y;
            const labelText = node.label.length > 50 ? `${node.label.slice(0, 50)}…` : node.label;
            // subtle dark plate behind label for readability
            ctx.fillStyle = "rgba(5,5,5,0.78)";
            const w = ctx.measureText(labelText).width;
            ctx.fillRect(labelX - 3, labelY - fontSize / 2 - 2, w + 6, fontSize + 4);
            ctx.fillStyle = isSelected || isRoot ? "#FFFFFF" : "rgba(229,229,229,0.92)";
            ctx.fillText(labelText, labelX, labelY);
          }

          ctx.restore();
        }}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, Math.max(node.size + 2, 7), 0, Math.PI * 2);
          ctx.fill();
        }}
        onNodeClick={(n: any) => {
          fgRef.current?.centerAt(n.x, n.y, 700);
          fgRef.current?.zoom(Math.max(fgRef.current?.zoom() ?? 1, 2.4), 700);
          select(n.mem);
        }}
        onNodeRightClick={(n: any) => {
          if (n.isRoot) return;
          n.fx = undefined; n.fy = undefined;
        }}
        onNodeHover={(n: any) => setHovered(n?.id ?? null)}
        onBackgroundClick={() => { select(null); fitGraph(700); }}
        onBackgroundRightClick={() => fitGraph(700)}
      />
    </div>
  );
}
