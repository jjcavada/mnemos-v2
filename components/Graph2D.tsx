"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMemoriesStore, applyFilters } from "@/store/memories";
import type { Memory } from "@/lib/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type NodeKind = "me" | "category-project" | "category-life" | "memory";

type Node = {
  id: string;
  kind: NodeKind;
  label: string;
  size: number;
  groupKey: string;        // own id for hubs; "cat:..." for memories
  color?: string;          // category accent
  x: number;
  y: number;
  fx?: number;
  fy?: number;
  mem?: Memory;            // only for memory nodes
};

type Link = { source: string; target: string; relation: string };

const ME_ID = "me:jay";

export function Graph2D() {
  const { memories, relationships, projectsById, lifeAreas, select, selected, filters } = useMemoriesStore();
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
    const memoryIds = new Set(filtered.map(m => m.id));

    // ----- determine which categories are present -----
    const usedProjectIds = new Set<string>();
    const usedLifeSlugs = new Set<string>();
    filtered.forEach(m => {
      if (m.is_project && m.project_id) usedProjectIds.add(m.project_id);
      else if (!m.is_project) usedLifeSlugs.add(m.life_area ?? "other");
    });

    const projectCats = Array.from(usedProjectIds).map(pid => {
      const p = projectsById[pid];
      return {
        id: `cat:project:${pid}`,
        label: (p?.name ?? "Project").toUpperCase(),
        color: "#E5E5E5",
        projectId: pid
      };
    });

    const lifeCats = Array.from(usedLifeSlugs).map(slug => {
      const la = lifeAreas.find(l => l.slug === slug);
      return {
        id: `cat:life:${slug}`,
        label: (la?.name ?? slug).toUpperCase(),
        color: "#A1A1AA",
        lifeSlug: slug
      };
    });

    const allCats = [...projectCats, ...lifeCats];

    // ----- radial seeding: ME at center, categories on a ring -----
    const HUB_RADIUS = 280;
    const catCenter: Record<string, { x: number; y: number }> = {};
    allCats.forEach((c, i) => {
      const angle = (i / Math.max(allCats.length, 1)) * Math.PI * 2 - Math.PI / 2;
      catCenter[c.id] = {
        x: Math.cos(angle) * HUB_RADIUS,
        y: Math.sin(angle) * HUB_RADIUS
      };
    });

    // ----- build node list -----
    const nodes: Node[] = [];

    // me
    nodes.push({
      id: ME_ID,
      kind: "me",
      label: "JAY",
      size: 14,
      groupKey: ME_ID,
      x: 0, y: 0, fx: 0, fy: 0
    });

    // category nodes
    for (const c of allCats) {
      nodes.push({
        id: c.id,
        kind: c.id.startsWith("cat:project:") ? "category-project" : "category-life",
        label: c.label,
        size: 6.5,
        groupKey: c.id,
        color: c.color,
        x: catCenter[c.id].x,
        y: catCenter[c.id].y
      });
    }

    // memory nodes — bucketed under their category
    const catBuckets: Record<string, string[]> = {};
    for (const m of filtered) {
      const cat = m.is_project && m.project_id
        ? `cat:project:${m.project_id}`
        : `cat:life:${m.life_area ?? "other"}`;
      (catBuckets[cat] ||= []).push(m.id);
    }
    const catBucketIdx: Record<string, number> = {};
    Object.values(catBuckets).forEach(b => b.forEach((id, i) => { catBucketIdx[id] = i; }));

    for (const m of filtered) {
      const cat = m.is_project && m.project_id
        ? `cat:project:${m.project_id}`
        : `cat:life:${m.life_area ?? "other"}`;
      const center = catCenter[cat] ?? { x: 0, y: 0 };
      const bucket = catBuckets[cat];
      const idx = catBucketIdx[m.id];
      const angle = bucket.length === 1 ? 0 : (idx / bucket.length) * Math.PI * 2;
      const localR = 60 + (idx % 4) * 14;
      nodes.push({
        id: m.id,
        kind: "memory",
        label: m.summary || m.content.slice(0, 60),
        size: 2.6,
        groupKey: cat,
        x: center.x + Math.cos(angle) * localR,
        y: center.y + Math.sin(angle) * localR,
        mem: m
      });
    }

    // ----- build link list -----
    const syntheticLinks: Link[] = [];

    // ME → category spine
    for (const c of allCats) {
      syntheticLinks.push({ source: ME_ID, target: c.id, relation: "spine" });
    }

    // category → its memories
    for (const m of filtered) {
      const cat = m.is_project && m.project_id
        ? `cat:project:${m.project_id}`
        : `cat:life:${m.life_area ?? "other"}`;
      syntheticLinks.push({ source: cat, target: m.id, relation: "contains" });
    }

    // existing memory↔memory relationships
    const memoryLinks: Link[] = relationships
      .filter(r => memoryIds.has(r.from_memory) && memoryIds.has(r.to_memory))
      .map(r => ({ source: r.from_memory, target: r.to_memory, relation: r.relation_type }));

    return {
      nodes,
      links: [...syntheticLinks, ...memoryLinks],
      catCenter,
      catIds: new Set(allCats.map(c => c.id))
    };
  }, [memories, relationships, projectsById, lifeAreas, filters]);

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

  // forces — ME pinned, categories pulled to their orbital seeds, memories pulled to their category
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || data.nodes.length === 0) return;
    try {
      const charge = typeof fg.d3Force === "function" ? fg.d3Force("charge") : null;
      if (charge && typeof charge.strength === "function") {
        charge.strength((n: any) => {
          if (n.kind === "me") return -1500;
          if (n.kind?.startsWith("category")) return -350;
          return -55;
        });
        if (typeof charge.distanceMax === "function") charge.distanceMax(500);
      }
      const link = typeof fg.d3Force === "function" ? fg.d3Force("link") : null;
      if (link) {
        link.distance((l: any) => {
          if (l.relation === "spine") return 240;     // me → category: long
          if (l.relation === "contains") return 70;    // category → memory: tight
          return 200;                                  // memory ↔ memory cross-cluster
        });
        link.strength((l: any) => {
          if (l.relation === "spine") return 0.85;
          if (l.relation === "contains") return 0.7;
          return 0.05;
        });
      }
      if (typeof fg.d3Force === "function") fg.d3Force("center", null);

      // custom pull: categories toward their seed ring, memories toward their category center
      const hubPull = (alpha: number) => {
        const k = 0.18 * alpha;
        for (const n of data.nodes as any[]) {
          if (n.kind === "me") continue;
          if (n.kind === "category-project" || n.kind === "category-life") {
            const seed = data.catCenter[n.id];
            if (!seed) continue;
            n.vx = (n.vx ?? 0) + (seed.x - (n.x ?? 0)) * k * 1.5;
            n.vy = (n.vy ?? 0) + (seed.y - (n.y ?? 0)) * k * 1.5;
            continue;
          }
          // memory
          const seed = data.catCenter[n.groupKey];
          if (!seed) continue;
          n.vx = (n.vx ?? 0) + (seed.x - (n.x ?? 0)) * k;
          n.vy = (n.vy ?? 0) + (seed.y - (n.y ?? 0)) * k;
        }
      };
      if (typeof fg.d3Force === "function") fg.d3Force("hub", hubPull);

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
    fg.zoomToFit(duration, 80);
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
        warmupTicks={160}
        cooldownTicks={500}
        cooldownTime={20000}
        d3VelocityDecay={0.50}
        d3AlphaDecay={0.018}
        enableNodeDrag={true}
        onNodeDrag={(node: any) => {
          if (node.id === ME_ID) return;
          node.fx = node.x;
          node.fy = node.y;
        }}
        onNodeDragEnd={(node: any) => {
          if (node.id === ME_ID) { node.fx = 0; node.fy = 0; return; }
          node.fx = node.x;
          node.fy = node.y;
        }}
        linkColor={(l: any) => {
          const focus = selected?.id ?? hovered;
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          if (l.relation === "spine") return "rgba(229,229,229,0.30)";
          if (l.relation === "contains") return "rgba(229,229,229,0.16)";
          // memory ↔ memory
          if (focus && (sId === focus || tId === focus)) return "rgba(255,255,255,0.55)";
          return "rgba(255,255,255,0.06)";
        }}
        linkWidth={(l: any) => {
          const focus = selected?.id ?? hovered;
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          if (l.relation === "spine") return 1.0;
          if (l.relation === "contains") return 0.5;
          if (focus && (sId === focus || tId === focus)) return 1.0;
          return 0.3;
        }}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
          const focus = focusOf(node.id);
          const dimmed = focus === "dim";
          const isSelected = focus === "selected";
          const r = node.size;

          ctx.save();
          ctx.globalAlpha = dimmed ? 0.18 : 1;

          // ----- ME: large silver disc with hairline ring + JAY label -----
          if (node.kind === "me") {
            // outer hairline ring (breathing-room marker)
            ctx.strokeStyle = "rgba(229,229,229,0.20)";
            ctx.lineWidth = 0.6 / scale;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 50, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(node.x, node.y, 90, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(229,229,229,0.10)";
            ctx.stroke();

            // soft halo
            ctx.globalCompositeOperation = "lighter";
            const halo = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 5.5);
            halo.addColorStop(0, "rgba(229,229,229,0.25)");
            halo.addColorStop(0.5, "rgba(229,229,229,0.06)");
            halo.addColorStop(1, "rgba(229,229,229,0)");
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = "source-over";

            // outer thin ring on the disc itself
            ctx.strokeStyle = "rgba(229,229,229,0.85)";
            ctx.lineWidth = 1.2 / scale;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 3, 0, Math.PI * 2);
            ctx.stroke();

            // disc fill
            ctx.fillStyle = "#E5E5E5";
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
            ctx.fill();

            // dark interior ring (lens)
            ctx.fillStyle = "#050505";
            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 0.55, 0, Math.PI * 2);
            ctx.fill();

            // tiny silver center
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 0.18, 0, Math.PI * 2);
            ctx.fill();

            // label below the breathing-ring
            const fs = Math.max(11 / scale, 4);
            ctx.font = `600 ${fs}px Geist Sans, Inter, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#E5E5E5";
            ctx.fillText("JAY", node.x, node.y + 70);
            const sublabelFs = Math.max(8 / scale, 3);
            ctx.font = `400 ${sublabelFs}px Geist Mono, monospace`;
            ctx.fillStyle = "rgba(161,161,170,0.7)";
            ctx.fillText("THE PERSON", node.x, node.y + 70 + sublabelFs + 4);

            ctx.restore();
            return;
          }

          // ----- category hub: medium disc + always-visible label -----
          if (node.kind === "category-project" || node.kind === "category-life") {
            // ring
            ctx.strokeStyle = isSelected ? "rgba(255,255,255,0.95)" : "rgba(229,229,229,0.55)";
            ctx.lineWidth = (isSelected ? 1.4 : 0.9) / scale;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 3, 0, Math.PI * 2);
            ctx.stroke();

            // fill
            ctx.fillStyle = node.kind === "category-project" ? "rgba(229,229,229,0.92)" : "rgba(161,161,170,0.85)";
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
            ctx.fill();
            // dark hollow
            ctx.fillStyle = "#050505";
            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 0.45, 0, Math.PI * 2);
            ctx.fill();

            // label
            const fs = Math.max(9.5 / scale, 3.4);
            ctx.font = `500 ${fs}px Geist Mono, monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            // dark plate behind label for readability
            const labelY = node.y + r + 8;
            const labelText = node.label.length > 22 ? `${node.label.slice(0, 22)}…` : node.label;
            const w = ctx.measureText(labelText).width;
            ctx.fillStyle = "rgba(5,5,5,0.78)";
            ctx.fillRect(node.x - w / 2 - 3, labelY - 1, w + 6, fs + 4);
            ctx.fillStyle = node.kind === "category-project" ? "#F4F4F5" : "rgba(229,229,229,0.85)";
            ctx.fillText(labelText, node.x, labelY);

            ctx.restore();
            return;
          }

          // ----- memory: small white point -----
          // selected ring
          if (isSelected) {
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.lineWidth = 1.2 / scale;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 3, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.fillStyle = isSelected ? "#FFFFFF" : focus === "neighbor" ? "rgba(255,255,255,0.95)" : "rgba(229,229,229,0.85)";
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fill();

          // memory label only on hover/select with offset + plate
          const showLabel = isSelected || focus === "neighbor" || hovered === node.id;
          if (showLabel) {
            const fontSize = Math.max(10 / scale, 3.2);
            ctx.font = `500 ${fontSize}px Geist Sans, Inter, system-ui, sans-serif`;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            const labelX = node.x + r + 6;
            const labelText = node.label.length > 50 ? `${node.label.slice(0, 50)}…` : node.label;
            ctx.fillStyle = "rgba(5,5,5,0.85)";
            const w = ctx.measureText(labelText).width;
            ctx.fillRect(labelX - 3, node.y - fontSize / 2 - 2, w + 6, fontSize + 4);
            ctx.fillStyle = isSelected ? "#FFFFFF" : "rgba(229,229,229,0.92)";
            ctx.fillText(labelText, labelX, node.y);
          }

          ctx.restore();
        }}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
          ctx.fillStyle = color;
          const padding = node.kind === "me" ? 16 : node.kind?.startsWith("category") ? 10 : 4;
          ctx.beginPath();
          ctx.arc(node.x, node.y, Math.max(node.size + padding, 8), 0, Math.PI * 2);
          ctx.fill();
        }}
        onNodeClick={(n: any) => {
          if (n.kind === "me" || n.kind === "category-project" || n.kind === "category-life") {
            // pan + zoom on hub clicks; no drawer for now
            fgRef.current?.centerAt(n.x, n.y, 700);
            fgRef.current?.zoom(Math.max(fgRef.current?.zoom() ?? 1, 1.8), 700);
            return;
          }
          if (n.kind === "memory") {
            fgRef.current?.centerAt(n.x, n.y, 700);
            fgRef.current?.zoom(Math.max(fgRef.current?.zoom() ?? 1, 2.4), 700);
            select(n.mem);
          }
        }}
        onNodeRightClick={(n: any) => {
          if (n.id === ME_ID) return;
          if (n.kind === "category-project" || n.kind === "category-life") return;
          n.fx = undefined; n.fy = undefined;
        }}
        onNodeHover={(n: any) => setHovered(n?.id ?? null)}
        onBackgroundClick={() => { select(null); fitGraph(700); }}
        onBackgroundRightClick={() => fitGraph(700)}
      />
    </div>
  );
}
