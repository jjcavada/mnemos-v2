"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { ENTITY_KINDS, type EntityKind } from "@/lib/mnemos-schema";
import { useMemoriesStore } from "@/store/memories";
import type { Entity, Memory } from "@/lib/types";

export type EntityDrawerSlug = { mode: "edit"; slug: string } | { mode: "create" } | null;

type DetailResponse = {
  ok: boolean;
  entity: Entity | null;
  memories: Memory[];
  mention_count: number;
};

type DraftMetadata = {
  description: string;
  role: string;
  status: string;
  aliases: string[];
  links: Array<{ label: string; url: string }>;
  notes: string;
  custom: Array<{ key: string; value: string }>;
};

const STATUS_CHOICES = ["active", "watch", "dormant", "archived"] as const;

export function EntityDrawer({
  target,
  onClose,
  onSaved
}: {
  target: EntityDrawerSlug;
  onClose: () => void;
  onSaved: (entity: Entity) => void;
}) {
  const { select } = useMemoriesStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<EntityKind>("person");
  const [draft, setDraft] = useState<DraftMetadata>(emptyDraft());
  const [memories, setMemories] = useState<Memory[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!target) return;
    if (target.mode === "create") {
      setName("");
      setKind("person");
      setDraft(emptyDraft());
      setMemories([]);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    fetch(`/api/entities/${encodeURIComponent(target.slug)}`)
      .then(r => r.json())
      .then((json: DetailResponse) => {
        if (!json.ok) throw new Error("Load failed");
        const draftData = mergeDraft(json.entity?.metadata ?? {});
        setName(json.entity?.name ?? humanize(target.slug));
        setKind(json.entity?.kind ?? guessKindFromSlug(target.slug));
        setDraft(draftData);
        setMemories(json.memories ?? []);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [target]);

  if (!target) return null;

  async function save() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const metadata = serializeDraft(draft);
      const url = target!.mode === "create" ? "/api/entities" : `/api/entities/${encodeURIComponent(target!.slug)}`;
      const method = target!.mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name, kind, metadata, slug: target!.mode === "create" ? undefined : target!.slug })
      });
      const json = await res.json() as { ok: boolean; entity?: Entity; error?: string };
      if (!json.ok || !json.entity) throw new Error(json.error ?? "Save failed");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1400);
      onSaved(json.entity);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className="fixed top-[44px] right-[480px] left-[40px] bottom-0 z-20 fade-in"
        style={{ background: "rgba(5, 5, 5, 0.55)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", pointerEvents: "none" }}
      />
      <div
        className="fixed top-[44px] right-0 bottom-0 w-[480px] z-30 overflow-y-auto drawer-in"
        style={{ background: "rgba(8, 8, 8, 0.94)", borderLeft: "0.5px solid rgba(255,255,255,0.10)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)", boxShadow: "-12px 0 48px rgba(0,0,0,0.6)" }}
      >
      <div
        className="sticky top-0 px-5 py-4 flex items-start justify-between gap-3 z-10"
        style={{ background: "rgba(8, 8, 8, 0.94)", borderBottom: "0.5px solid rgba(255,255,255,0.06)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)" }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-text-3 mb-1.5">
            {target.mode === "create" ? "New entity" : "Editing entity"}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Daylon"
            className="w-full bg-transparent text-text-1 font-semibold text-lg outline-none focus:border-b focus:border-accent"
          />
          <div className="mt-2 flex items-center gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as EntityKind)}
              className="bg-bg-2 border border-border rounded px-2 py-1 text-[11px] text-text-2"
            >
              {ENTITY_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            {target.mode === "edit" && (
              <span className="text-[11px] text-text-3">{memories.length} mention{memories.length === 1 ? "" : "s"}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-accent text-black rounded text-xs font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : savedFlash ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {savedFlash ? "Saved" : "Save"}
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-bg-2 rounded text-text-3 hover:text-text-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <div className="px-5 pt-4 text-red-300 text-sm">{error}</div>}

      <div className="px-5 py-5 space-y-6">
        {loading && <div className="text-text-3 text-sm">Loading…</div>}

        <Field label="Description" hint="One short paragraph. Who or what is this, in your words.">
          <textarea
            value={draft.description}
            onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
            placeholder="Daylon is the automation lead at UDT Glendale. Owns the n8n + Retell stack."
            className="w-full min-h-[80px] bg-bg-2 border border-border rounded p-2.5 text-sm outline-none focus:border-accent"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <input
              value={draft.role}
              onChange={(e) => setDraft(d => ({ ...d, role: e.target.value }))}
              placeholder="Automation lead"
              className="w-full bg-bg-2 border border-border rounded p-2 text-sm outline-none focus:border-accent"
            />
          </Field>
          <Field label="Status">
            <select
              value={draft.status}
              onChange={(e) => setDraft(d => ({ ...d, status: e.target.value }))}
              className="w-full bg-bg-2 border border-border rounded p-2 text-sm outline-none focus:border-accent"
            >
              {STATUS_CHOICES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Aliases" hint="Comma-separated names this entity also goes by.">
          <input
            value={draft.aliases.join(", ")}
            onChange={(e) => setDraft(d => ({ ...d, aliases: splitList(e.target.value) }))}
            placeholder="Daylon Krebs, DK"
            className="w-full bg-bg-2 border border-border rounded p-2 text-sm outline-none focus:border-accent"
          />
        </Field>

        <Field label="Links" hint="Slack profile, LinkedIn, email, dashboards. Anything URL-shaped.">
          <div className="space-y-2">
            {draft.links.map((link, i) => (
              <div key={i} className="grid grid-cols-[120px_1fr_28px] gap-2">
                <input
                  value={link.label}
                  onChange={(e) => setDraft(d => ({ ...d, links: replaceAt(d.links, i, { ...link, label: e.target.value }) }))}
                  placeholder="slack"
                  className="bg-bg-2 border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
                <input
                  value={link.url}
                  onChange={(e) => setDraft(d => ({ ...d, links: replaceAt(d.links, i, { ...link, url: e.target.value }) }))}
                  placeholder="https://…"
                  className="bg-bg-2 border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
                <button onClick={() => setDraft(d => ({ ...d, links: removeAt(d.links, i) }))} className="text-text-3 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setDraft(d => ({ ...d, links: [...d.links, { label: "", url: "" }] }))}
              className="inline-flex items-center gap-1 text-[11px] text-text-3 hover:text-text-1"
            >
              <Plus className="w-3 h-3" /> Add link
            </button>
          </div>
        </Field>

        <Field label="Notes" hint="Free-form. Personality, gotchas, things you want AI to know.">
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft(d => ({ ...d, notes: e.target.value }))}
            placeholder="Daylon prefers async Slack DMs over calls. Doesn't trust marketing automation that doesn't write back to GHL."
            className="w-full min-h-[140px] bg-bg-2 border border-border rounded p-2.5 text-sm outline-none focus:border-accent"
          />
        </Field>

        <Field label="Custom fields" hint="Anything else. Birthday, company, mailing address, project rate, MBTI, whatever.">
          <div className="space-y-2">
            {draft.custom.map((row, i) => (
              <div key={i} className="grid grid-cols-[140px_1fr_28px] gap-2">
                <input
                  value={row.key}
                  onChange={(e) => setDraft(d => ({ ...d, custom: replaceAt(d.custom, i, { ...row, key: e.target.value }) }))}
                  placeholder="company"
                  className="bg-bg-2 border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
                <input
                  value={row.value}
                  onChange={(e) => setDraft(d => ({ ...d, custom: replaceAt(d.custom, i, { ...row, value: e.target.value }) }))}
                  placeholder="UDT"
                  className="bg-bg-2 border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
                <button onClick={() => setDraft(d => ({ ...d, custom: removeAt(d.custom, i) }))} className="text-text-3 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setDraft(d => ({ ...d, custom: [...d.custom, { key: "", value: "" }] }))}
              className="inline-flex items-center gap-1 text-[11px] text-text-3 hover:text-text-1"
            >
              <Plus className="w-3 h-3" /> Add field
            </button>
          </div>
        </Field>

        {target.mode === "edit" && memories.length > 0 && (
          <section>
            <div className="h-section mb-2">Mentions ({memories.length})</div>
            <div className="space-y-2">
              {memories.slice(0, 25).map(m => (
                <button key={m.id} onClick={() => select(m)} className="mem-card w-full text-left">
                  <div className="text-[13px] font-medium truncate">{m.summary || m.content.slice(0, 80)}</div>
                  <div className="text-[11px] text-text-3 mt-1">{m.type} · {new Date(m.created_at).toLocaleDateString()}</div>
                </button>
              ))}
              {memories.length > 25 && <div className="text-[11px] text-text-4">+{memories.length - 25} more</div>}
            </div>
          </section>
        )}
      </div>
    </div>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-text-3 mb-1.5">{label}</div>
      {hint && <div className="text-[11px] text-text-4 mb-2">{hint}</div>}
      {children}
    </div>
  );
}

function emptyDraft(): DraftMetadata {
  return {
    description: "",
    role: "",
    status: "active",
    aliases: [],
    links: [],
    notes: "",
    custom: []
  };
}

function mergeDraft(metadata: Record<string, unknown>): DraftMetadata {
  const d = emptyDraft();
  if (typeof metadata.description === "string") d.description = metadata.description;
  if (typeof metadata.role === "string") d.role = metadata.role;
  if (typeof metadata.status === "string" && (STATUS_CHOICES as readonly string[]).includes(metadata.status)) d.status = metadata.status;
  if (Array.isArray(metadata.aliases)) d.aliases = metadata.aliases.filter((v): v is string => typeof v === "string");
  if (typeof metadata.notes === "string") d.notes = metadata.notes;

  if (metadata.links && typeof metadata.links === "object" && !Array.isArray(metadata.links)) {
    d.links = Object.entries(metadata.links as Record<string, unknown>)
      .filter(([, v]) => typeof v === "string")
      .map(([label, url]) => ({ label, url: String(url) }));
  } else if (Array.isArray(metadata.links)) {
    d.links = metadata.links
      .filter((v): v is { label: string; url: string } => Boolean(v && typeof v === "object" && "label" in v && "url" in v))
      .map(v => ({ label: String(v.label ?? ""), url: String(v.url ?? "") }));
  }

  const reserved = new Set(["description", "role", "status", "aliases", "links", "notes"]);
  d.custom = Object.entries(metadata)
    .filter(([k, v]) => !reserved.has(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean"))
    .map(([key, value]) => ({ key, value: String(value) }));
  return d;
}

function serializeDraft(draft: DraftMetadata): Record<string, unknown> {
  const out: Record<string, unknown> = {
    description: draft.description.trim(),
    role: draft.role.trim(),
    status: draft.status,
    aliases: draft.aliases.map(s => s.trim()).filter(Boolean),
    notes: draft.notes.trim(),
    links: Object.fromEntries(
      draft.links
        .filter(l => l.label.trim() && l.url.trim())
        .map(l => [l.label.trim(), l.url.trim()])
    )
  };
  for (const row of draft.custom) {
    const k = row.key.trim();
    const v = row.value.trim();
    if (k && v && !(k in out)) out[k] = v;
  }
  return out;
}

function splitList(value: string): string[] {
  return value.split(",").map(s => s.trim()).filter(Boolean);
}

function replaceAt<T>(arr: T[], i: number, value: T): T[] {
  const out = arr.slice();
  out[i] = value;
  return out;
}

function removeAt<T>(arr: T[], i: number): T[] {
  return arr.filter((_, idx) => idx !== i);
}

function humanize(slug: string) {
  return slug.split("-").filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}

function guessKindFromSlug(slug: string): EntityKind {
  const PERSON = ["amber", "corey", "daylon", "jay", "tom"];
  const PLACE = ["glendale", "grapevine", "phoenix", "scottsdale"];
  const TOOL = ["ghl", "make", "n8n", "netlify", "openai", "retell", "signwell", "slack", "supabase", "vercel"];
  const ORG = ["caredash", "nutrition-intuition", "suncovia", "udt", "uni-k-wax"];
  if (PERSON.some(p => slug.includes(p))) return "person";
  if (PLACE.some(p => slug.includes(p))) return "place";
  if (TOOL.some(t => slug.includes(t))) return "tool";
  if (ORG.some(o => slug.includes(o))) return "organization";
  return "concept";
}
