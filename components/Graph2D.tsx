"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMemoriesStore, applyFilters } from "@/store/memories";
import { useGraphFocus } from "@/store/graph-focus";
import type { Memory } from "@/lib/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type NodeKind = "me" | "category-project" | "category-life" | "category-meta" | "memory";

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
const LINKS_CAT_ID = "cat:meta:links";

// A memory belongs to the Links cluster if it carries an http(s) source_url.
// This keeps Hermes' GitHub captures and any other web-link memories in their
// own orbital, separate from project/life clusters.
function bucketKeyFor(m: Memory): string {
  const url = m.source_url;
  if (typeof url === "string" && /^https?:\/\//i.test(url)) return LINKS_CAT_ID;
  return m.is_project && m.project_id
    ? `cat:project:${m.project_id}`
    : `cat:life:${m.life_area ?? "other"}`;
}

type GalaxyStar = { x: number; y: number; size: number; alpha: number; hue: "white" | "warm" | "cool" };

function generateGalaxyStars(count = 360): GalaxyStar[] {
  let seed = 9133;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const stars: GalaxyStar[] = [];
  const arms = 2;
  const armSpread = 0.55;
  for (let i = 0; i < count; i++) {
    const t = rand();
    const arm = Math.floor(rand() * arms);
    const armOffset = (arm / arms) * Math.PI * 2;
    // logarithmic spiral: angle grows with radius (tight twist)
    const radius = 8 + Math.pow(t, 0.55) * 110;
    const baseAngle = armOffset + radius * 0.10;
    const angle = baseAngle + (rand() - 0.5) * armSpread * (1 - t * 0.6);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.42; // flatten to disc
    const size = 0.7 + rand() * 1.6 * (1 - t * 0.45);
    const alpha = 0.45 + rand() * 0.5 * (1 - t * 0.35);
    const hue = rand() < 0.18 ? "warm" : rand() < 0.16 ? "cool" : "white";
    stars.push({ x, y, size, alpha, hue });
  }
  // a handful of brighter foreground stars
  for (let i = 0; i < 30; i++) {
    const r = 10 + rand() * 95;
    const a = rand() * Math.PI * 2;
    stars.push({
      x: Math.cos(a) * r,
      y: Math.sin(a) * r * 0.42,
      size: 1.4 + rand() * 1.4,
      alpha: 0.85 + rand() * 0.15,
      hue: rand() < 0.25 ? "warm" : "white"
    });
  }
  return stars;
}

const GALAXY_STARS: GalaxyStar[] = generateGalaxyStars();

export function Graph2D() {
  const { memories, relationships, projectsById, lifeAreas, select, selected, filters } = useMemoriesStore();
  const focusTarget = useGraphFocus(s => s.target);
  const clearFocus = useGraphFocus(s => s.clear);
  const fgRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const parallaxRef = useRef<HTMLDivElement | null>(null);
  const hoveredRef = useRef<string | null>(null);
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

  // mouse parallax — translate the canvas wrapper by a few px against cursor
  useEffect(() => {
    const wrap = wrapperRef.current;
    const px = parallaxRef.current;
    if (!wrap || !px) return;
    let raf = 0;
    let targetX = 0, targetY = 0;
    let curX = 0, curY = 0;
    const onMove = (e: MouseEvent) => {
      const r = wrap.getBoundingClientRect();
      targetX = ((e.clientX - r.left) / r.width - 0.5) * -8;
      targetY = ((e.clientY - r.top) / r.height - 0.5) * -8;
    };
    const onLeave = () => { targetX = 0; targetY = 0; };
    const tick = () => {
      curX += (targetX - curX) * 0.08;
      curY += (targetY - curY) * 0.08;
      px.style.transform = `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    wrap.addEventListener("mousemove", onMove);
    wrap.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(tick);
    return () => {
      wrap.removeEventListener("mousemove", onMove);
      wrap.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  const data = useMemo(() => {
    const filtered = applyFilters(memories);
    const memoryIds = new Set(filtered.map(m => m.id));

    // ----- determine which categories are present -----
    const usedProjectIds = new Set<string>();
    const usedLifeSlugs = new Set<string>();
    let hasLinks = false;
    filtered.forEach(m => {
      const key = bucketKeyFor(m);
      if (key === LINKS_CAT_ID) { hasLinks = true; return; }
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

    const metaCats = hasLinks
      ? [{ id: LINKS_CAT_ID, label: "LINKS", color: "#A1A1AA", metaSlug: "links" }]
      : [];

    const allCats = [...projectCats, ...lifeCats, ...metaCats];

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
      const kind: NodeKind =
        c.id.startsWith("cat:project:") ? "category-project"
        : c.id.startsWith("cat:meta:") ? "category-meta"
        : "category-life";
      nodes.push({
        id: c.id,
        kind,
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
      (catBuckets[bucketKeyFor(m)] ||= []).push(m.id);
    }
    const catBucketIdx: Record<string, number> = {};
    Object.values(catBuckets).forEach(b => b.forEach((id, i) => { catBucketIdx[id] = i; }));

    for (const m of filtered) {
      const cat = bucketKeyFor(m);
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
      syntheticLinks.push({ source: bucketKeyFor(m), target: m.id, relation: "contains" });
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

      // gravity: when a memory is hovered, nearby memories drift toward it
      const nodeIndex = new Map(data.nodes.map((n: any) => [n.id, n]));
      const gravityPull = (alpha: number) => {
        const hovId = hoveredRef.current;
        if (!hovId) return;
        const target: any = nodeIndex.get(hovId);
        if (!target || target.kind === "me") return;
        const k = 0.05 * alpha;
        for (const n of data.nodes as any[]) {
          if (n.id === hovId) continue;
          if (n.kind === "me" || n.kind?.startsWith("category")) continue;
          const dx = (target.x ?? 0) - (n.x ?? 0);
          const dy = (target.y ?? 0) - (n.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 4 || dist > 110) continue;
          n.vx = (n.vx ?? 0) + (dx / dist) * k;
          n.vy = (n.vy ?? 0) + (dy / dist) * k;
        }
      };
      if (typeof fg.d3Force === "function") fg.d3Force("gravity", gravityPull);

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

  // ----- camera fly-to for Cmd-K focus targets -----
  // Polls until the requested node has settled coordinates, then pans+zooms.
  // For memory nodes, also opens the drawer.
  useEffect(() => {
    if (!focusTarget) return;
    const fg = fgRef.current;
    if (!fg) return;
    // If graph hasn't seeded yet (just navigated in from another route),
    // leave the target in place — the effect will re-run when `data` populates.
    if (data.nodes.length === 0) return;
    const node: any = data.nodes.find((n: any) => n.id === focusTarget.id);
    if (!node) { clearFocus(); return; }

    let cancelled = false;
    let attempts = 0;
    const tryFly = () => {
      if (cancelled) return;
      attempts++;
      if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
        try {
          fg.centerAt(node.x, node.y, 800);
          const targetZoom =
            node.kind === "memory" ? 2.6
            : node.kind === "me" ? 1.4
            : 1.9;
          fg.zoom(targetZoom, 800);
        } catch { /* ignore */ }
        if (focusTarget.selectMemory && node.kind === "memory" && node.mem) {
          select(node.mem);
        }
        // briefly highlight via hover state
        setHovered(node.id);
        setTimeout(() => {
          setHovered(prev => (prev === node.id ? null : prev));
        }, 1800);
        clearFocus();
        return;
      }
      if (attempts < 40) setTimeout(tryFly, 80);
      else clearFocus();
    };
    tryFly();
    return () => { cancelled = true; };
  }, [focusTarget, data, select, clearFocus]);

  return (
    <div ref={wrapperRef} className="absolute inset-0">
      <div ref={parallaxRef} className="absolute inset-0 will-change-transform" style={{ transition: "transform 80ms linear" }}>
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

          // ---- spring scale: target 1.15 when hovered, 1.0 otherwise (lerped per frame) ----
          const targetScale = focus === "selected" || focus === "neighbor" || hovered === node.id ? 1.15 : 1.0;
          node._scale = (node._scale ?? 1) + (targetScale - (node._scale ?? 1)) * 0.18;
          const r = node.size * node._scale;

          // ---- pulse: selected nodes oscillate alpha 0.6-1.0 on a 2s cycle ----
          const pulseAlpha = isSelected
            ? 0.7 + 0.3 * Math.sin(Date.now() / 320)
            : 1;

          // ---- float: category nodes drift y by sin wave, ME stays still ----
          let drawY = node.y;
          if (typeof node.kind === "string" && node.kind.startsWith("category")) {
            drawY = node.y + Math.sin(Date.now() / 1400 + (node.x + node.y) * 0.005) * 4;
          }

          ctx.save();
          ctx.globalAlpha = dimmed ? 0.18 : pulseAlpha;

          // ----- ME: rotating spiral galaxy at the heart of the brain -----
          if (node.kind === "me") {
            // breathing-room markers (kept for design continuity)
            ctx.strokeStyle = "rgba(229,229,229,0.16)";
            ctx.lineWidth = 0.7 / scale;
            ctx.beginPath();
            ctx.arc(node.x, drawY, 140, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = "rgba(229,229,229,0.07)";
            ctx.beginPath();
            ctx.arc(node.x, drawY, 180, 0, Math.PI * 2);
            ctx.stroke();

            // galaxy is rendered in its own coordinate frame, slowly rotating
            ctx.save();
            ctx.translate(node.x, drawY);
            const time = Date.now();
            const rotation = time / 9000; // visibly rotating
            ctx.rotate(rotation);

            // outer disc halo — dark purplish, fades far out
            const haloGrad = ctx.createRadialGradient(0, 0, 30, 0, 0, 140);
            haloGrad.addColorStop(0, "rgba(120, 96, 140, 0.18)");
            haloGrad.addColorStop(0.45, "rgba(70, 70, 110, 0.08)");
            haloGrad.addColorStop(1, "rgba(20, 20, 40, 0)");
            ctx.fillStyle = haloGrad;
            ctx.beginPath();
            ctx.ellipse(0, 0, 140, 60, 0, 0, Math.PI * 2);
            ctx.fill();

            // mid-disc warm wash (underglow of spiral arms)
            const midGrad = ctx.createRadialGradient(0, 0, 6, 0, 0, 110);
            midGrad.addColorStop(0, "rgba(255, 215, 160, 0.65)");
            midGrad.addColorStop(0.2, "rgba(240, 180, 140, 0.40)");
            midGrad.addColorStop(0.55, "rgba(180, 140, 160, 0.18)");
            midGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = midGrad;
            ctx.beginPath();
            ctx.ellipse(0, 0, 110, 48, 0, 0, Math.PI * 2);
            ctx.fill();

            // stars on the spiral arms (additive blend so they bloom)
            ctx.globalCompositeOperation = "lighter";
            for (const s of GALAXY_STARS) {
              ctx.globalAlpha = s.alpha;
              ctx.fillStyle =
                s.hue === "warm" ? "rgba(255, 220, 165, 1)"
                : s.hue === "cool" ? "rgba(190, 210, 255, 1)"
                : "rgba(255, 255, 255, 1)";
              ctx.beginPath();
              ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.restore();

            // bright core (canvas-space, NOT rotated)
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            // wide soft outer bloom
            const bloomGrad = ctx.createRadialGradient(node.x, drawY, 0, node.x, drawY, 36);
            bloomGrad.addColorStop(0, "rgba(255, 245, 220, 1)");
            bloomGrad.addColorStop(0.35, "rgba(255, 220, 180, 0.55)");
            bloomGrad.addColorStop(1, "rgba(255, 200, 150, 0)");
            ctx.fillStyle = bloomGrad;
            ctx.beginPath();
            ctx.arc(node.x, drawY, 36, 0, Math.PI * 2);
            ctx.fill();
            // tight hot core
            const coreGrad = ctx.createRadialGradient(node.x, drawY, 0, node.x, drawY, 14);
            coreGrad.addColorStop(0, "rgba(255, 255, 255, 1)");
            coreGrad.addColorStop(0.45, "rgba(255, 240, 210, 0.95)");
            coreGrad.addColorStop(1, "rgba(255, 220, 160, 0)");
            ctx.fillStyle = coreGrad;
            ctx.beginPath();
            ctx.arc(node.x, drawY, 14, 0, Math.PI * 2);
            ctx.fill();
            // pinhole singularity
            ctx.fillStyle = "rgba(255, 255, 255, 1)";
            ctx.beginPath();
            ctx.arc(node.x, drawY, 2.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = "source-over";
            ctx.restore();

            // label below the galaxy disc
            const fs = Math.max(11 / scale, 4);
            ctx.font = `600 ${fs}px Geist Sans, Inter, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#E5E5E5";
            ctx.fillText("JAY", node.x, node.y + 156);
            const sublabelFs = Math.max(8 / scale, 3);
            ctx.font = `400 ${sublabelFs}px Geist Mono, monospace`;
            ctx.fillStyle = "rgba(161,161,170,0.7)";
            ctx.fillText("THE PERSON", node.x, node.y + 156 + sublabelFs + 4);

            ctx.restore();
            return;
          }

          // ----- category hub: medium disc + always-visible label, gentle float -----
          if (node.kind === "category-project" || node.kind === "category-life" || node.kind === "category-meta") {
            const cy = drawY;
            const isMeta = node.kind === "category-meta";
            // ring
            ctx.strokeStyle = isSelected ? "rgba(255,255,255,0.95)"
              : isMeta ? "rgba(180,210,255,0.65)"
              : "rgba(229,229,229,0.55)";
            ctx.lineWidth = (isSelected ? 1.6 : 0.9) / scale;
            ctx.beginPath();
            ctx.arc(node.x, cy, r + 3, 0, Math.PI * 2);
            ctx.stroke();

            // fill
            ctx.fillStyle = node.kind === "category-project" ? "rgba(229,229,229,0.92)"
              : isMeta ? "rgba(190,210,255,0.85)"
              : "rgba(161,161,170,0.85)";
            ctx.beginPath();
            ctx.arc(node.x, cy, r, 0, Math.PI * 2);
            ctx.fill();
            // dark hollow
            ctx.fillStyle = "#050505";
            ctx.beginPath();
            ctx.arc(node.x, cy, r * 0.45, 0, Math.PI * 2);
            ctx.fill();

            // meta-only inner accent dot — denotes "links / external"
            if (isMeta) {
              ctx.fillStyle = "rgba(190,210,255,0.95)";
              ctx.beginPath();
              ctx.arc(node.x, cy, r * 0.18, 0, Math.PI * 2);
              ctx.fill();
            }

            // label
            const fs = Math.max(9.5 / scale, 3.4);
            ctx.font = `500 ${fs}px Geist Mono, monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            const labelY = cy + r + 8;
            const labelText = node.label.length > 22 ? `${node.label.slice(0, 22)}…` : node.label;
            const w = ctx.measureText(labelText).width;
            ctx.fillStyle = "rgba(5,5,5,0.78)";
            ctx.fillRect(node.x - w / 2 - 3, labelY - 1, w + 6, fs + 4);
            ctx.fillStyle = node.kind === "category-project" ? "#F4F4F5"
              : isMeta ? "rgba(200,220,255,0.95)"
              : "rgba(229,229,229,0.85)";
            ctx.fillText(labelText, node.x, labelY);

            ctx.restore();
            return;
          }

          // ----- memory: small white point with optional bloom on focus -----
          if (isSelected) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = "rgba(255,255,255,0.55)";
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.lineWidth = 1.4 / scale;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          // bloom drop-shadow on hover/neighbor
          if (focus === "neighbor" || hovered === node.id) {
            ctx.shadowBlur = 8;
            ctx.shadowColor = "rgba(255,255,255,0.30)";
          }
          ctx.fillStyle = isSelected ? "#FFFFFF" : focus === "neighbor" ? "rgba(255,255,255,0.95)" : "rgba(229,229,229,0.85)";
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

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
          const isHub = n.kind === "me" || (typeof n.kind === "string" && n.kind.startsWith("category"));
          if (isHub) {
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
          if (typeof n.kind === "string" && n.kind.startsWith("category")) return;
          n.fx = undefined; n.fy = undefined;
        }}
        onNodeHover={(n: any) => {
          setHovered(n?.id ?? null);
          hoveredRef.current = n?.id ?? null;
          // gentle reheat so gravity force can act
          if (n && fgRef.current?.d3ReheatSimulation) {
            try { fgRef.current.d3ReheatSimulation(); } catch { /* ignore */ }
          }
        }}
        onBackgroundClick={() => { select(null); fitGraph(700); }}
        onBackgroundRightClick={() => fitGraph(700)}
      />
      </div>
    </div>
  );
}
