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
  tier: number;
  isRoot: boolean;
  groupKey: string;
  x: number;
  y: number;
  fx?: number;
  fy?: number;
  mem: Memory;
};

type Star = {
  x: number;     // 0..1 (fraction of canvas width)
  y: number;     // 0..1
  size: number;  // px
  base: number;  // base alpha
  twSpeed: number;
  phase: number;
  hue: string;
};

const ROOT_GLOW = "#fbbf24";   // warm amber
const TIER_1_GLOW = "#7dd3fc"; // ice cyan
const TIER_2_GLOW = "#a5b4fc"; // soft violet

function hexWithAlpha(hex: string, a: number) {
  // accept #rrggbb or #rgb; clamp alpha 0-1
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

export function Graph2D() {
  const { memories, relationships, projectsById, select, filters } = useMemoriesStore();
  const fgRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const starsRef = useRef<Star[] | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

    // adjacency + degree
    const adj: Record<string, Set<string>> = {};
    for (const l of links) {
      (adj[l.source] ||= new Set()).add(l.target);
      (adj[l.target] ||= new Set()).add(l.source);
    }
    const degree = (id: string) => adj[id]?.size ?? 0;

    // pick root: highest degree, tiebreak by importance
    let root: Memory | null = null;
    if (filtered.length > 0) {
      root = filtered[0];
      for (const m of filtered) {
        const dg = degree(m.id);
        const rdg = root ? degree(root.id) : -1;
        const cmp = dg - rdg;
        if (cmp > 0 || (cmp === 0 && (m.importance_score ?? 0) > (root?.importance_score ?? 0))) {
          root = m;
        }
      }
    }

    // BFS tier from root
    const tier: Record<string, number> = {};
    if (root) {
      tier[root.id] = 0;
      const queue: string[] = [root.id];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const nx of adj[cur] ?? []) {
          if (tier[nx] === undefined) {
            tier[nx] = tier[cur] + 1;
            queue.push(nx);
          }
        }
      }
    }
    const orphanTier = (Object.values(tier).reduce((m, v) => Math.max(m, v), 0) || 0) + 2;
    filtered.forEach(m => {
      if (tier[m.id] === undefined) tier[m.id] = orphanTier;
    });

    // group by project (or life-area) so each project becomes its own constellation
    const groupKeyOf = (m: Memory) =>
      m.is_project ? `p:${m.project_id ?? "unset"}` : `l:${m.life_area ?? "other"}`;
    const rootGroupKey = root ? groupKeyOf(root) : null;
    const groupKeys = Array.from(new Set(filtered.map(groupKeyOf)));
    const otherGroups = groupKeys.filter(k => k !== rootGroupKey);

    // metadata per group (label + color) for auras / labels
    const groupMeta: Record<string, { label: string; color: string }> = {};
    for (const gk of groupKeys) {
      const sample = filtered.find(m => groupKeyOf(m) === gk);
      if (!sample) continue;
      if (sample.is_project) {
        const proj = sample.project_id ? projectsById[sample.project_id] : undefined;
        groupMeta[gk] = {
          label: (proj?.name ?? "PROJECT").toUpperCase(),
          color: proj?.color ?? "#7dd3fc"
        };
      } else {
        groupMeta[gk] = {
          label: `LIFE · ${(sample.life_area ?? "other").toUpperCase()}`,
          color: "#a8a8b1"
        };
      }
    }

    // place each non-root group at its own angle around the root, distributed evenly on a circle
    const SATELLITE_RADIUS = 320;
    const groupCenter: Record<string, { gx: number; gy: number; localR: number; label: string; color: string }> = {};
    if (rootGroupKey) {
      const meta = groupMeta[rootGroupKey] ?? { label: "ORIGIN", color: "#fbbf24" };
      groupCenter[rootGroupKey] = { gx: 0, gy: 0, localR: 80, label: meta.label, color: meta.color };
    }
    otherGroups.forEach((gk, i) => {
      // full 360 degree distribution, starting at top
      const angle = (i / Math.max(otherGroups.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const meta = groupMeta[gk] ?? { label: "", color: "#7dd3fc" };
      groupCenter[gk] = {
        gx: Math.cos(angle) * SATELLITE_RADIUS,
        gy: Math.sin(angle) * SATELLITE_RADIUS,
        localR: 60,
        label: meta.label,
        color: meta.color
      };
    });

    // local indexing within each group for stable angles
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
      const center = groupCenter[gk] ?? { gx: 0, gy: 0, localR: 100 };
      const bucket = groupBuckets[gk];
      const idx = groupIdx[m.id];
      const angle = bucket.length === 1 ? 0 : (idx / bucket.length) * Math.PI * 2;
      const isRoot = root !== null && m.id === root.id;
      const localR = center.localR * (0.6 + (idx % 4) * 0.18); // mild internal spread
      const x = isRoot ? 0 : center.gx + Math.cos(angle) * localR;
      const y = isRoot ? 0 : center.gy + Math.sin(angle) * localR;
      return {
        id: m.id,
        label: m.summary || m.content.slice(0, 60),
        color: memoryColor(m, projectsById),
        size: (isRoot ? 7 : 4) + Math.sqrt(connCount[m.id] ?? 0) * 1.35 + (m.importance_score ?? 0.5),
        tier: tier[m.id],
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

  // force tuning — clusters lock tightly to their assigned center, charge keeps internal spacing
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || data.nodes.length === 0) return;
    try {
      const charge = typeof fg.d3Force === "function" ? fg.d3Force("charge") : null;
      if (charge && typeof charge.strength === "function") {
        charge.strength(-65);
        if (typeof charge.distanceMax === "function") charge.distanceMax(220);
      }
      const link = typeof fg.d3Force === "function" ? fg.d3Force("link") : null;
      if (link && typeof link.distance === "function") {
        const groupMap = new Map(data.nodes.map(n => [n.id, n.groupKey]));
        link.distance((l: any) => {
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          const sg = groupMap.get(sId);
          const tg = groupMap.get(tId);
          return sg && tg && sg === tg ? 26 : 200;
        });
        if (typeof link.strength === "function") link.strength((l: any) => {
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          const sg = groupMap.get(sId);
          const tg = groupMap.get(tId);
          return sg && tg && sg === tg ? 0.65 : 0.05; // intra-cluster locks tight; cross-cluster barely pulls
        });
      }
      if (typeof fg.d3Force === "function") fg.d3Force("center", null);
      // strong cluster pull — keeps each constellation locked to its assigned orbit
      const clusterPull = (alpha: number) => {
        const k = 0.22 * alpha;
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
    const focus = selectedId ?? hovered;
    if (!focus) return "normal";
    if (id === focus) return "selected";
    if (neighborMap[focus]?.has(id)) return "neighbor";
    return "dim";
  }

  function fitGraph(duration = 700) {
    const fg = fgRef.current;
    if (!fg) return;
    fg.zoomToFit(duration, 70);
    // HUD aside covers ~330px on the right; shift constellation left so it visually centers in the HUD-free zone.
    // The camera moves to world (offsetX, 0), so world origin appears offsetX pixels left of screen center.
    const wrapper = wrapperRef.current;
    const w = wrapper?.clientWidth ?? 0;
    const offsetX = w > 720 ? 165 : w > 520 ? 90 : 0;
    if (offsetX > 0) {
      window.setTimeout(() => fg.centerAt(offsetX, 0, Math.min(duration, 400)), duration + 30);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => fitGraph(900), 800);
    return () => clearTimeout(t);
  }, [data]);

  function ensureStars(w: number, h: number): Star[] {
    if (starsRef.current && starsRef.current.length) return starsRef.current;
    const palette = [
      "rgba(255,255,255,1)",
      "rgba(207,250,254,1)",
      "rgba(186,230,253,1)",
      "rgba(253,224,71,0.9)",
      "rgba(196,181,253,0.95)"
    ];
    const stars: Star[] = [];
    const count = 240;
    let seed = 1337;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < count; i++) {
      const big = rand() < 0.05;
      stars.push({
        x: rand(),
        y: rand(),
        size: big ? 1.6 + rand() * 0.6 : 0.6 + rand() * 0.7,
        base: big ? 0.65 + rand() * 0.3 : 0.18 + rand() * 0.4,
        twSpeed: 0.4 + rand() * 1.4,
        phase: rand() * Math.PI * 2,
        hue: palette[Math.floor(rand() * palette.length)]
      });
    }
    starsRef.current = stars;
    return stars;
  }

  return (
    <div ref={wrapperRef} className="absolute inset-0">
      <ForceGraph2D
        ref={fgRef as any}
        width={size.w || undefined}
        height={size.h || undefined}
        graphData={graphData}
        backgroundColor="#03060c"
        nodeRelSize={1}
        warmupTicks={140}
        cooldownTicks={400}
        cooldownTime={15000}
        d3VelocityDecay={0.34}
        d3AlphaDecay={0.02}
        enableNodeDrag={true}
        onNodeDrag={(node: any) => {
          node.fx = node.x;
          node.fy = node.y;
        }}
        onNodeDragEnd={(node: any) => {
          if (node.isRoot) { node.fx = 0; node.fy = 0; return; }
          node.fx = node.x;
          node.fy = node.y;
        }}
        onEngineStop={() => fitGraph(500)}
        linkColor={(l: any) => {
          const focus = selectedId ?? hovered;
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          const sNode = data.nodes.find(n => n.id === sId);
          const tNode = data.nodes.find(n => n.id === tId);
          const sameCluster = sNode && tNode && sNode.groupKey === tNode.groupKey;
          const touchesRoot = sId === data.rootId || tId === data.rootId;
          if (!focus) {
            // Only show intra-cluster + root-touching edges by default. Cross-cluster fade to nearly invisible.
            if (sameCluster) return "rgba(125,211,252,0.30)";
            if (touchesRoot) return "rgba(253,224,71,0.30)";
            return "rgba(125,211,252,0.04)";
          }
          if (sId === focus || tId === focus) return RELATION_EDGE_COLORS[l.relation] ?? "#a8a8b1";
          return "rgba(70,80,95,0.05)";
        }}
        linkWidth={(l: any) => {
          const focus = selectedId ?? hovered;
          const sId = typeof l.source === "object" ? l.source.id : l.source;
          const tId = typeof l.target === "object" ? l.target.id : l.target;
          const sNode = data.nodes.find(n => n.id === sId);
          const tNode = data.nodes.find(n => n.id === tId);
          const sameCluster = sNode && tNode && sNode.groupKey === tNode.groupKey;
          const touchesRoot = sId === data.rootId || tId === data.rootId;
          if (!focus) {
            if (sameCluster) return 0.7;
            if (touchesRoot) return 1.0;
            return 0.3;
          }
          return (sId === focus || tId === focus) ? 1.9 : 0.35;
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
        onRenderFramePre={(ctx: CanvasRenderingContext2D) => {
          const w = ctx.canvas.width;
          const h = ctx.canvas.height;

          // ---- starfield (screen-space, twinkles with time) ----
          const stars = ensureStars(w, h);
          const time = Date.now() / 1000;
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          for (const s of stars) {
            const tw = 0.55 + 0.45 * Math.sin(time * s.twSpeed + s.phase);
            ctx.globalAlpha = Math.min(1, s.base * tw);
            ctx.fillStyle = s.hue;
            const px = s.x * w;
            const py = s.y * h;
            ctx.beginPath();
            ctx.arc(px, py, s.size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();

          // ---- concentric orbital paths (planetary system motif) ----
          ctx.save();
          // dotted radial guide rings
          const dashed = [3, 5];
          ctx.setLineDash(dashed);
          ctx.lineWidth = 0.8;
          [110, 220, 330].forEach((r, i) => {
            ctx.strokeStyle = `rgba(125,211,252,${0.13 - i * 0.025})`;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.stroke();
          });
          // outer system boundary — slightly stronger dashed
          ctx.setLineDash([6, 8]);
          ctx.lineWidth = 1;
          ctx.strokeStyle = "rgba(125,211,252,0.15)";
          ctx.beginPath();
          ctx.arc(0, 0, 470, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // ---- per-cluster auras (soft colored backdrops) ----
          for (const gk of Object.keys(data.groupCenter)) {
            const gc = data.groupCenter[gk];
            const aura = ctx.createRadialGradient(gc.gx, gc.gy, 0, gc.gx, gc.gy, 130);
            aura.addColorStop(0, hexWithAlpha(gc.color, 0.10));
            aura.addColorStop(0.6, hexWithAlpha(gc.color, 0.03));
            aura.addColorStop(1, hexWithAlpha(gc.color, 0));
            ctx.fillStyle = aura;
            ctx.beginPath();
            ctx.arc(gc.gx, gc.gy, 130, 0, Math.PI * 2);
            ctx.fill();
          }

          // ---- root core bloom + 4-spike lens flare ----
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          // core bloom
          const coreGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 160);
          coreGlow.addColorStop(0, "rgba(253,224,71,0.30)");
          coreGlow.addColorStop(0.4, "rgba(251,191,36,0.10)");
          coreGlow.addColorStop(1, "rgba(251,191,36,0)");
          ctx.fillStyle = coreGlow;
          ctx.beginPath();
          ctx.arc(0, 0, 160, 0, Math.PI * 2);
          ctx.fill();
          // 4 lens-flare spikes — gradient lines extending out
          const spikeLen = 220;
          const spikeGrad = (a: number) => {
            const g = ctx.createLinearGradient(0, 0, Math.cos(a) * spikeLen, Math.sin(a) * spikeLen);
            g.addColorStop(0, "rgba(253,224,71,0.65)");
            g.addColorStop(0.4, "rgba(251,191,36,0.18)");
            g.addColorStop(1, "rgba(251,191,36,0)");
            return g;
          };
          const angles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
          ctx.lineWidth = 1.4;
          for (const a of angles) {
            ctx.strokeStyle = spikeGrad(a);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * spikeLen, Math.sin(a) * spikeLen);
            ctx.stroke();
          }
          // diagonal spikes (shorter, fainter)
          const diagLen = 140;
          ctx.lineWidth = 0.8;
          for (const a of [Math.PI / 4, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
            const dg = ctx.createLinearGradient(0, 0, Math.cos(a) * diagLen, Math.sin(a) * diagLen);
            dg.addColorStop(0, "rgba(253,224,71,0.35)");
            dg.addColorStop(1, "rgba(251,191,36,0)");
            ctx.strokeStyle = dg;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * diagLen, Math.sin(a) * diagLen);
            ctx.stroke();
          }
          ctx.restore();
          ctx.restore();
        }}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
          const r = node.size;
          const focus = focusOf(node.id);
          const dimmed = focus === "dim";
          const isSelected = focus === "selected" && selectedId === node.id;
          const isRoot = node.isRoot;

          const haloColor = isRoot ? ROOT_GLOW
            : node.tier === 1 ? TIER_1_GLOW
            : node.tier === 2 ? TIER_2_GLOW
            : node.color;

          ctx.save();
          ctx.globalAlpha = dimmed ? 0.18 : 1;

          // pulsing halo for the root
          const pulse = isRoot ? (1 + 0.18 * Math.sin(Date.now() / 700)) : 1;

          ctx.globalCompositeOperation = "lighter";
          const glowR = r * (isSelected ? 9 : isRoot ? 7 : 4.5) * pulse;
          const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
          glow.addColorStop(0, `${haloColor}99`);
          glow.addColorStop(0.4, `${haloColor}22`);
          glow.addColorStop(1, `${haloColor}00`);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(node.x, node.y, glowR, 0, 2 * Math.PI);
          ctx.fill();

          ctx.globalCompositeOperation = "source-over";

          // root gets a thin amber ring at distance
          if (isRoot) {
            ctx.strokeStyle = "rgba(251,191,36,0.55)";
            ctx.lineWidth = 1.2 / scale;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 2.6, 0, 2 * Math.PI);
            ctx.stroke();
          }

          ctx.strokeStyle = isSelected ? "#ffffff" : isRoot ? "#fde68a" : `${haloColor}cc`;
          ctx.lineWidth = (isSelected ? 1.7 : isRoot ? 1.2 : 0.7) / scale;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * (isSelected ? 2.4 : isRoot ? 1.9 : 1.6), 0, 2 * Math.PI);
          ctx.stroke();

          ctx.fillStyle = isSelected ? "#ffffff" : dimmed ? "#3a3a43" : isRoot ? "#fde68a" : node.color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fill();

          if (focus === "neighbor" || isSelected) {
            ctx.strokeStyle = isSelected ? "#fef3c7" : haloColor;
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

          const showLabel = isRoot || isSelected || focus === "neighbor" || hovered === node.id || scale > 2.35;
          if (showLabel) {
            const fontSize = isSelected ? Math.max(13 / scale, 4) : isRoot ? Math.max(11 / scale, 4) : Math.max(10 / scale, 3);
            ctx.font = `${isSelected || isRoot ? "700" : "600"} ${fontSize}px JetBrains Mono, Inter, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = isSelected ? "#ffffff" : isRoot ? "#fde68a" : "rgba(207,250,254,0.78)";
            const labelText = isRoot ? `★ ${node.label}` : node.label;
            const label = labelText.length > 46 ? `${labelText.slice(0, 46)}...` : labelText;
            ctx.fillText(label, node.x, node.y + r + 6);
          }

          ctx.restore();
        }}
        onRenderFramePost={(ctx: CanvasRenderingContext2D, scale: number) => {
          // cluster labels — drawn after nodes so they read clearly
          ctx.save();
          for (const gk of Object.keys(data.groupCenter)) {
            const gc = data.groupCenter[gk];
            if (!gc.label) continue;
            const fontSize = Math.max(9 / scale, 3.2);
            ctx.font = `600 ${fontSize}px JetBrains Mono, monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            // distance label outside the cluster's local radius
            const labelOffset = (gc.gx === 0 && gc.gy === 0) ? -120 : 95;
            const lx = gc.gx;
            const ly = gc.gy + labelOffset;
            ctx.fillStyle = hexWithAlpha(gc.color, 0.85);
            ctx.fillText(gc.label, lx, ly);
            // tiny horizontal tick under the label
            ctx.strokeStyle = hexWithAlpha(gc.color, 0.5);
            ctx.lineWidth = 0.7 / scale;
            ctx.beginPath();
            ctx.moveTo(lx - 28, ly + 5);
            ctx.lineTo(lx + 28, ly + 5);
            ctx.stroke();
          }
          ctx.restore();
        }}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, Math.max(node.size, 9), 0, 2 * Math.PI);
          ctx.fill();
        }}
        onNodeClick={(n: any) => {
          setSelectedId(n.id);
          fgRef.current?.centerAt(n.x, n.y, 700);
          fgRef.current?.zoom(Math.max(fgRef.current?.zoom() ?? 1, 2.4), 700);
          select(n.mem);
        }}
        onNodeRightClick={(n: any) => {
          if (n.isRoot) return; // root stays anchored
          n.fx = undefined;
          n.fy = undefined;
        }}
        onNodeHover={(n: any) => setHovered(n?.id ?? null)}
        onBackgroundClick={() => { setSelectedId(null); fitGraph(700); }}
        onBackgroundRightClick={() => fitGraph(700)}
      />
    </div>
  );
}
