"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookmarkPlus,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Loader2,
  Sparkles,
  X
} from "lucide-react";
import { useMemoriesStore } from "@/store/memories";
import { MemoryDrawer } from "@/components/MemoryDrawer";
import { EntityDrawer, type EntityDrawerSlug } from "@/components/EntityDrawer";
import type { Entity, Memory, Project } from "@/lib/types";

type Confidence = "high" | "medium" | "low";

type AnswerResponse = {
  ok: boolean;
  query?: string;
  answer?: string | null;
  confidence?: Confidence;
  missing?: string | null;
  followups?: string[];
  entities?: Entity[];
  projects?: Array<Project & { memory_count: number }>;
  principles?: Memory[];
  memories?: Array<Memory & { why?: string }>;
  context_markdown?: string;
  generated_at?: string;
  error?: string;
};

const RECENTS_KEY = "mnemos_recent_queries_v1";
const QUICK_QUERIES = [
  "Who is Daylon?",
  "What does Amber do?",
  "UDT Glendale stack",
  "Nutrition Intuition status",
  "May 1 incident",
  "n8n timezone gotcha"
];

export default function RecallPage() {
  const { select, refresh } = useMemoriesStore();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AnswerResponse | null>(null);
  const [error, setError] = useState("");
  const [recents, setRecents] = useState<string[]>([]);
  const [showContext, setShowContext] = useState(false);
  const [savingMemory, setSavingMemory] = useState<"saving" | "saved" | null>(null);
  const [entityTarget, setEntityTarget] = useState<EntityDrawerSlug>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RECENTS_KEY);
      if (raw) setRecents(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function pushRecent(q: string) {
    const next = [q, ...recents.filter(r => r.toLowerCase() !== q.toLowerCase())].slice(0, 8);
    setRecents(next);
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    }
  }

  async function ask(rawQuery?: string) {
    const q = (rawQuery ?? query).trim();
    if (!q) return;
    setQuery(q);
    setLoading(true);
    setError("");
    setResponse(null);
    setShowContext(false);
    setSavingMemory(null);
    pushRecent(q);
    try {
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q, k: 12 })
      });
      const json = await res.json() as AnswerResponse;
      if (!json.ok) throw new Error(json.error ?? "Answer failed");
      setResponse(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Answer failed");
    } finally {
      setLoading(false);
    }
  }

  async function exportArchive() {
    setError("");
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mnemos-archive.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function saveAnswerAsMemory() {
    if (!response?.answer || !response.query) return;
    setSavingMemory("saving");
    try {
      const text = `Q: ${response.query}\n\nA: ${response.answer}\n\nConfidence: ${response.confidence ?? "low"}` +
        (response.missing ? `\n\nMissing context: ${response.missing}` : "");
      const res = await fetch("/api/capture/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          title: `Q&A: ${response.query.slice(0, 80)}`,
          source: "manual",
          tags: ["recall", "qa", "saved-answer"],
          is_project: false,
          life_area: "other",
          importance: 0.6
        })
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setSavingMemory("saved");
      void refresh();
      setTimeout(() => setSavingMemory(null), 2200);
    } catch (err) {
      setSavingMemory(null);
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  function clearAll() {
    setQuery("");
    setResponse(null);
    setError("");
    setShowContext(false);
    inputRef.current?.focus();
  }

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="sticky top-0 z-10 px-8 py-3" style={{ background: "rgba(5,5,5,0.78)", borderBottom: "0.5px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-center justify-between max-w-[860px] mx-auto">
          <span className="font-mono text-[10px] tracking-[0.32em] uppercase text-text-3">Recall · Ask</span>
          <button
            onClick={exportArchive}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-text-3 hover:text-text-1 transition-colors"
            style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.08)" }}
          >
            <Download className="w-3 h-3" />
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase">Export</span>
          </button>
        </div>
      </div>

      <div className="max-w-[860px] mx-auto px-8 pt-8 pb-16">
        {/* ask input */}
        <section className="bento-card mb-3 spring-in">
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-text-3 shrink-0" strokeWidth={1.6} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !loading) void ask(); }}
              placeholder="Ask anything · Mnemos pulls only the relevant memories"
              className="flex-1 bg-transparent outline-none text-[14px] placeholder-text-3 text-text-1"
              style={{ letterSpacing: "0.001em" }}
            />
            {query && (
              <button onClick={clearAll} className="p-1 text-text-3 hover:text-text-1">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => void ask()}
              disabled={loading || !query.trim()}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md text-[12px] font-medium disabled:opacity-40 transition-opacity"
              style={{ background: "rgba(229,229,229,0.92)", color: "#0a0a0a" }}
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" strokeWidth={1.8} />}
              Ask
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {QUICK_QUERIES.map(q => (
              <button key={q} onClick={() => void ask(q)} className="pill text-[11px]">{q}</button>
            ))}
          </div>
        </section>

        {recents.length > 0 && !response && !loading && (
          <section className="mb-4">
            <div className="h-micro mb-2">Recent</div>
            <div className="flex flex-wrap gap-1.5">
              {recents.map(r => (
                <button key={r} onClick={() => void ask(r)} className="pill text-[11px] h-[22px]">{r}</button>
              ))}
            </div>
          </section>
        )}

        {error && (
          <div className="mb-4 px-3 py-2 rounded-md text-[12px]" style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.12)", color: "#F4F4F5" }}>
            {error}
          </div>
        )}

        {loading && (
          <div className="text-text-3 text-[13px] py-12 text-center flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Pulling memories. Composing answer.
          </div>
        )}

        {response && !loading && (
          <>
            <AnswerCard
              response={response}
              onAsk={ask}
              onSave={saveAnswerAsMemory}
              saving={savingMemory}
            />

            {(response.entities ?? []).length > 0 && (
              <EntitiesRow
                entities={response.entities ?? []}
                onOpen={(slug) => setEntityTarget({ mode: "edit", slug })}
              />
            )}

            {(response.projects ?? []).length > 0 && (
              <ProjectsRow projects={response.projects ?? []} />
            )}

            <MemoriesList
              memories={response.memories ?? []}
              principles={response.principles ?? []}
              onPick={(m) => select(m)}
            />

            {response.context_markdown && (
              <ContextPackToggle
                show={showContext}
                onToggle={() => setShowContext(s => !s)}
                markdown={response.context_markdown}
              />
            )}
          </>
        )}

        {!response && !loading && <EmptyState />}
      </div>

      <MemoryDrawer />
      <EntityDrawer
        target={entityTarget}
        onClose={() => setEntityTarget(null)}
        onSaved={() => setEntityTarget(null)}
      />
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const labelMap: Record<Confidence, string> = {
    high: "high signal",
    medium: "partial",
    low: "uncertain"
  };
  const colorMap: Record<Confidence, string> = {
    high: "rgba(229,229,229,0.92)",
    medium: "rgba(161,161,170,0.85)",
    low: "rgba(113,113,122,0.75)"
  };
  return (
    <span
      className="font-mono text-[9.5px] tracking-[0.18em] uppercase px-2 py-0.5 rounded"
      style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", color: colorMap[confidence] }}
    >
      {labelMap[confidence]}
    </span>
  );
}

function AnswerCard({
  response,
  onAsk,
  onSave,
  saving
}: {
  response: AnswerResponse;
  onAsk: (q: string) => void;
  onSave: () => void;
  saving: "saving" | "saved" | null;
}) {
  return (
    <section className="bento-card mb-3 spring-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-micro">Answer</span>
          {response.confidence && <ConfidenceBadge confidence={response.confidence} />}
        </div>
        <button
          onClick={onSave}
          disabled={saving === "saving" || !response.answer}
          className="inline-flex items-center gap-1.5 h-6 px-2 rounded text-[10px] font-mono tracking-[0.14em] uppercase text-text-3 hover:text-text-1 disabled:opacity-40 transition-colors"
          style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.08)" }}
        >
          {saving === "saving" ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookmarkPlus className="w-3 h-3" />}
          {saving === "saved" ? "Saved" : saving === "saving" ? "Saving" : "Save"}
        </button>
      </div>

      {response.answer ? (
        <div className="text-text-1 text-[15px] leading-relaxed whitespace-pre-wrap" style={{ letterSpacing: "0.001em" }}>{response.answer}</div>
      ) : (
        <div className="text-text-3 text-[13px]">{response.missing ?? "No memories matched this query."}</div>
      )}

      {response.missing && response.answer && (
        <div className="mt-3 text-[12px] text-text-3 pl-3" style={{ borderLeft: "0.5px solid rgba(229,229,229,0.32)" }}>
          <span className="h-micro mr-2">Missing</span>{response.missing}
        </div>
      )}

      {(response.followups?.length ?? 0) > 0 && (
        <div className="mt-5">
          <div className="h-micro mb-2">Follow up</div>
          <div className="flex flex-wrap gap-1.5">
            {(response.followups ?? []).map(q => (
              <button key={q} onClick={() => onAsk(q)} className="pill text-[11px]">{q}</button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function EntitiesRow({ entities, onOpen }: { entities: Entity[]; onOpen: (slug: string) => void }) {
  return (
    <section className="mb-3">
      <div className="h-micro mb-2">People &amp; entities</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {entities.map(e => {
          const meta = (e.metadata ?? {}) as Record<string, unknown>;
          const description = typeof meta.description === "string" ? meta.description : "";
          const role = typeof meta.role === "string" ? meta.role : "";
          return (
            <button
              key={e.slug}
              onClick={() => onOpen(e.slug)}
              className="bento-tight text-left transition-colors hover:bg-white/[0.04]"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="font-medium text-[13px] text-text-1">{e.name}</div>
                <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-text-4">{e.kind}</div>
              </div>
              {role && <div className="text-[11px] text-text-3 mb-1">{role}</div>}
              {description ? (
                <div className="text-[12px] text-text-2 line-clamp-3" style={{ letterSpacing: "0.001em" }}>{description}</div>
              ) : (
                <div className="text-[11px] text-text-4">No profile yet — click to add.</div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ProjectsRow({ projects }: { projects: Array<Project & { memory_count: number }> }) {
  return (
    <section className="mb-3">
      <div className="h-micro mb-2">Projects</div>
      <div className="flex flex-wrap gap-1.5">
        {projects.map(p => (
          <div key={p.id} className="inline-flex items-center gap-2.5 pill h-[28px]">
            <span className="text-[12px] text-text-1 font-medium">{p.name}</span>
            <span className="font-mono text-[9.5px] text-text-4 tracking-wider">· {p.memory_count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MemoriesList({
  memories,
  principles,
  onPick
}: {
  memories: Array<Memory & { why?: string }>;
  principles: Memory[];
  onPick: (m: Memory) => void;
}) {
  const principleIds = useMemo(() => new Set(principles.map(p => p.id)), [principles]);
  const dedupedPrinciples = useMemo(() => principles.filter(p => !memories.find(m => m.id === p.id)), [memories, principles]);

  if (memories.length === 0 && dedupedPrinciples.length === 0) {
    return <section className="text-text-3 text-[12px] py-8 text-center">No matching memories.</section>;
  }

  return (
    <>
      {dedupedPrinciples.length > 0 && (
        <section className="mb-3">
          <div className="h-micro mb-2">Relevant principles</div>
          <div className="space-y-1.5">
            {dedupedPrinciples.map(m => (
              <button key={m.id} onClick={() => onPick(m)} className="mem-card w-full text-left">
                <div className="text-[13px] font-medium text-text-1">{m.summary || m.content.slice(0, 140)}</div>
                <div className="font-mono text-[10px] tracking-wider text-text-4 mt-1 uppercase">
                  {m.type} · importance {Math.round((m.importance_score ?? 0) * 100)}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mb-3">
        <div className="flex items-baseline justify-between mb-2">
          <span className="h-micro">Top memories</span>
          <span className="font-mono text-[10px] tracking-wider text-text-4 uppercase">{memories.length}</span>
        </div>
        <div className="space-y-1.5">
          {memories.map(m => (
            <button key={m.id} onClick={() => onPick(m)} className="mem-card w-full text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-text-1">{m.summary || m.content.slice(0, 160)}</div>
                  <div className="font-mono text-[10px] tracking-wider text-text-4 mt-1 uppercase flex items-center gap-1.5 flex-wrap">
                    <span>{m.type}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{new Date(m.created_at).toLocaleDateString()}</span>
                    {m.why && <><span>·</span><span>{m.why}</span></>}
                    {principleIds.has(m.id) && <><span>·</span><span className="text-text-1">principle</span></>}
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-text-4 shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function ContextPackToggle({ show, onToggle, markdown }: { show: boolean; onToggle: () => void; markdown: string }) {
  return (
    <section className="mb-8">
      <button onClick={onToggle} className="inline-flex items-center gap-2 text-[11px] tracking-wider uppercase font-mono text-text-3 hover:text-text-1 transition-colors">
        {show ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <FileText className="w-3 h-3" />
        {show ? "Hide" : "Show"} context pack
      </button>
      {show && (
        <pre className="mt-3 whitespace-pre-wrap text-[11.5px] text-text-2 leading-relaxed font-mono max-h-[480px] overflow-y-auto bento p-4">
          {markdown}
        </pre>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <section className="py-16">
      <div className="max-w-md mx-auto text-center space-y-3 text-text-3">
        <div className="font-mono text-[10px] tracking-[0.32em] uppercase text-text-4">Mnemos · idle</div>
        <div className="text-[14px] text-text-2">Ask a question.</div>
        <div className="text-[12px] text-text-4 leading-relaxed">
          Try a person, a project, or an incident.<br />
          Mnemos pulls only the relevant memories, then composes a direct answer.
        </div>
        <div className="pt-2">
          <span className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-text-4 inline-flex items-center gap-1">
            <ArrowUpRight className="w-2.5 h-2.5" /> ⌘K opens command palette
          </span>
        </div>
      </div>
    </section>
  );
}
