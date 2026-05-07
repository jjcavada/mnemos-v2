"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { sb } from "@/lib/supabase";
import type { Entity, Project } from "@/lib/types";
import { useMemoriesStore } from "@/store/memories";
import { MemoryDrawer } from "@/components/MemoryDrawer";
import { EntityDrawer, type EntityDrawerSlug } from "@/components/EntityDrawer";

type EntityKind = Entity["kind"];
type AggregatedEntity = {
  slug: string;
  name: string;
  kind: EntityKind;
  mentions: number;
  ids: string[];
  sources: Set<string>;
  metadata: Record<string, unknown>;
};

export default function PeoplePage() {
  const { memories, projectsById } = useMemoriesStore();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [target, setTarget] = useState<EntityDrawerSlug>(null);

  async function loadEntities() {
    const { data } = await sb.from("entities").select("*").order("name");
    setEntities((data ?? []) as Entity[]);
  }

  useEffect(() => {
    void loadEntities();
  }, []);

  const aggregated = useMemo(() => {
    const counts: Record<string, AggregatedEntity> = {};
    const entitiesBySlug = Object.fromEntries(entities.map(e => [e.slug, e]));

    function add(slug: string, name: string, kind: EntityKind, memoryId: string, source: string) {
      const key = slugify(slug || name);
      if (!key) return;
      const existing = entitiesBySlug[key];
      if (!counts[key]) {
        counts[key] = {
          slug: key,
          name: existing?.name ?? name,
          kind: existing?.kind ?? kind,
          mentions: 0,
          ids: [],
          sources: new Set(),
          metadata: existing?.metadata ?? {}
        };
      }
      counts[key].mentions++;
      counts[key].ids.push(memoryId);
      counts[key].sources.add(source);
    }

    memories.forEach(m => {
      (m.entities ?? []).forEach(slug => {
        const entity = entitiesBySlug[slug.toLowerCase()];
        add(slug, entity?.name ?? titleizeTag(slug), entity?.kind ?? "concept", m.id, "distilled");
      });

      if (m.project_id && projectsById[m.project_id]) {
        const project = projectsById[m.project_id];
        add(project.slug, project.name, projectKind(project), m.id, "project");
      }

      (m.tags ?? []).forEach(tag => {
        const inferred = inferTagEntity(tag);
        if (inferred) add(inferred.slug, inferred.name, inferred.kind, m.id, "tag");
      });

      entities.forEach(entity => {
        const hay = `${m.summary ?? ""} ${m.content} ${(m.tags ?? []).join(" ")}`.toLowerCase();
        if (hay.includes(entity.name.toLowerCase()) || hay.includes(entity.slug.replaceAll("-", " "))) {
          add(entity.slug, entity.name, entity.kind, m.id, "table");
        }
      });
    });

    return Object.values(counts)
      .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name));
  }, [memories, entities, projectsById]);

  const visible = filter === "all" ? aggregated : aggregated.filter(v => v.kind === filter);

  return (
    <div className="absolute inset-0 overflow-y-auto p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">People & Entities</h1>
          <p className="text-text-3 text-sm">Click any card to add details so AI knows who/what they are.</p>
        </div>
        <button
          onClick={() => setTarget({ mode: "create" })}
          className="inline-flex items-center gap-2 px-3 py-2 bg-accent text-black rounded-lg text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          New entity
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {["all", "person", "place", "organization", "book", "tool", "concept"].map(k => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`pill ${filter === k ? "active" : ""}`}
          >{k}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {visible.map(v => {
          const description = typeof v.metadata?.description === "string" ? v.metadata.description : "";
          const role = typeof v.metadata?.role === "string" ? v.metadata.role : "";
          const hasDetails = Boolean(description || role);
          return (
            <button
              key={v.slug}
              onClick={() => setTarget({ mode: "edit", slug: v.slug })}
              className="bg-bg-1 border border-border rounded-lg p-4 text-left hover:border-border-strong transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-text-1 font-semibold text-sm truncate">{v.name}</div>
                  <div className="text-[11px] text-text-3 mt-1">
                    {v.kind} · {v.mentions} mention{v.mentions !== 1 ? "s" : ""}
                    {role && <> · {role}</>}
                  </div>
                </div>
                {hasDetails && <span className="text-[10px] text-accent">profiled</span>}
              </div>
              {description && (
                <div className="text-[12px] text-text-2 mt-2 line-clamp-3">{description}</div>
              )}
              {!description && (
                <div className="mt-3 space-y-1">
                  {unique(v.ids).slice(0, 2).map(id => {
                    const m = memories.find(x => x.id === id);
                    if (!m) return null;
                    return (
                      <div key={id} className="text-[11px] text-text-3 truncate">
                        - {m.summary || m.content.slice(0, 50)}
                      </div>
                    );
                  })}
                  {unique(v.ids).length > 2 && <div className="text-[10px] text-text-4">+{unique(v.ids).length - 2} more</div>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="text-text-3 text-sm py-12 text-center">
          No matching entities yet. Click <span className="text-accent">New entity</span> to add one manually, or capture more memories to populate links automatically.
        </div>
      )}

      <EntityDrawer
        target={target}
        onClose={() => setTarget(null)}
        onSaved={(saved) => {
          setEntities(prev => {
            const without = prev.filter(e => e.slug !== saved.slug);
            return [...without, saved].sort((a, b) => a.name.localeCompare(b.name));
          });
          setTarget({ mode: "edit", slug: saved.slug });
        }}
      />
      <MemoryDrawer />
    </div>
  );
}

const IGNORED_TAGS = new Set([
  "asset", "bug-fix", "client-info", "decision", "fact", "incident", "learning", "manual",
  "meeting-note", "milestone", "pattern", "prompt", "question", "reference", "reflection",
  "reminder", "todo", "workflow", "rule", "architecture", "gotcha", "smoke-test", "codex",
  "mnemos-phase-2", "raw-capture"
]);

const PERSON_TAGS: Record<string, string> = {
  "amber": "Amber",
  "amber-barcellos": "Amber Barcellos",
  "corey": "Corey",
  "corey-krebs": "Corey Krebs",
  "daylon": "Daylon",
  "jay": "Jay",
  "tom": "Tom",
  "tom-irwin": "Tom Irwin"
};

const PLACE_TAGS: Record<string, string> = {
  "glendale": "Glendale",
  "grapevine": "Grapevine",
  "phoenix": "Phoenix",
  "scottsdale": "Scottsdale"
};

const TOOL_TAGS: Record<string, string> = {
  "ghl": "GHL",
  "make": "Make",
  "n8n": "n8n",
  "netlify": "Netlify",
  "openai": "OpenAI",
  "retell": "Retell",
  "signwell": "SignWell",
  "slack": "Slack",
  "supabase": "Supabase",
  "vercel": "Vercel"
};

const ORGANIZATION_TAGS: Record<string, string> = {
  "caredash": "CareDash",
  "caredash-pro": "CareDash Pro",
  "nutrition-intuition": "Nutrition Intuition",
  "suncovia": "Suncovia",
  "udt": "UDT",
  "udt-glendale": "UDT Glendale",
  "udt-grapevine": "UDT Grapevine",
  "udt-scottsdale": "UDT Scottsdale",
  "uni-k-wax": "Uni K Wax"
};

function inferTagEntity(tag: string): { slug: string; name: string; kind: EntityKind } | null {
  const slug = slugify(tag);
  if (!slug || IGNORED_TAGS.has(slug)) return null;
  if (PERSON_TAGS[slug]) return { slug, name: PERSON_TAGS[slug], kind: "person" };
  if (PLACE_TAGS[slug]) return { slug, name: PLACE_TAGS[slug], kind: "place" };
  if (TOOL_TAGS[slug]) return { slug, name: TOOL_TAGS[slug], kind: "tool" };
  if (ORGANIZATION_TAGS[slug]) return { slug, name: ORGANIZATION_TAGS[slug], kind: "organization" };
  return { slug, name: titleizeTag(slug), kind: "concept" };
}

function projectKind(project: Project): EntityKind {
  if (project.slug.includes("xrp")) return "concept";
  if (project.slug.includes("automation")) return "tool";
  return "organization";
}

function titleizeTag(tag: string) {
  return tag.split("-").filter(Boolean).map(part => {
    const upper = part.toUpperCase();
    if (["AI", "API", "CRM", "DNC", "GHL", "LLC", "MCP", "TCPA", "UDT", "XRP"].includes(upper)) return upper;
    if (part === "n8n") return "n8n";
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(" ");
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}
