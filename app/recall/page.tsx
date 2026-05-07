"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookmarkPlus,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileText,
  History,
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
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
    <div className="absolute inset-0 overflow-y-auto p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-accent" />
            Recall
          </h1>
          <p className="text-text-3 text-sm mt-1">Ask anything. Mnemos pulls only the relevant memories, then composes a direct answer.</p>
        </div>
        <button
          onClick={exportArchive}
          className="inline-flex items-center gap-2 px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-text-2 hover:text-text-1 hover:border-border-strong"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      <section className="bg-bg-1 border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-accent shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !loading) void ask(); }}
            placeholder="Who is Daylon? What's blocking Nutrition Intuition? UDT Glendale n8n stack…"
            className="flex-1 bg-transparent outline-none text-sm placeholder-text-3"
          />
          {query && (
            <button onClick={clearAll} className="p-1 text-text-3 hover:text-text-1">
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => void ask()}
            disabled={loading || !query.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-black rounded-lg text-xs font-semibold disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Ask
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {QUICK_QUERIES.map(q => (
            <button
              key={q}
              onClick={() => void ask(q)}
              className="text-[11px] px-2.5 py-1 bg-bg-2 border border-border rounded-full text-text-3 hover:text-text-1 hover:border-border-strong"
            >{q}</button>
          ))}
        </div>
      </section>

      {recents.length > 0 && !response && !loading && (
        <section className="mb-4 text-[11px] text-text-3">
          <div className="flex items-center gap-2 mb-2">
            <History className="w-3.5 h-3.5" />
            <span>Recent queries</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recents.map(r => (
              <button
                key={r}
                onClick={() => void ask(r)}
                className="text-[11px] px-2 py-0.5 bg-bg-2 border border-border rounded text-text-3 hover:text-text-1"
              >{r}</button>
            ))}
          </div>
        </section>
      )}

      {error && <div className="mb-4 text-red-300 text-sm bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{error}</div>}

      {loading && (
        <div className="text-text-3 text-sm py-12 text-center flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Pulling memories and composing answer…
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

      {!response && !loading && (
        <EmptyState />
      )}

      <MemoryDrawer />
      <EntityDrawer
        target={entityTarget}
        onClose={() => setEntityTarget(null)}
        onSaved={() => setEntityTarget(null)}
      />
    </div>
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
  const confidenceColor = response.confidence === "high"
    ? "text-green-300 border-green-800/40"
    : response.confidence === "medium"
      ? "text-amber-300 border-amber-800/40"
      : "text-red-300 border-red-900/40";

  return (
    <section className="bg-bg-1 border border-border rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[11px] text-text-3">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span>Answer</span>
          {response.confidence && (
            <span className={`px-2 py-0.5 rounded border text-[10px] ${confidenceColor}`}>
              {response.confidence} confidence
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={saving === "saving" || !response.answer}
            className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 bg-bg-2 border border-border rounded text-text-3 hover:text-text-1 disabled:opacity-50"
          >
            {saving === "saving" ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookmarkPlus className="w-3 h-3" />}
            {saving === "saved" ? "Saved as memory" : saving === "saving" ? "Saving" : "Save as memory"}
          </button>
        </div>
      </div>

      {response.answer ? (
        <div className="text-text-1 text-[15px] leading-relaxed whitespace-pre-wrap">{response.answer}</div>
      ) : (
        <div className="text-text-3 text-sm">
          {response.missing ?? "No memories matched this query."}
        </div>
      )}

      {response.missing && response.answer && (
        <div className="mt-3 text-[12px] text-amber-300/80 border-l-2 border-amber-700/50 pl-3">
          Missing context: {response.missing}
        </div>
      )}

      {(response.followups?.length ?? 0) > 0 && (
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-wide text-text-3 mb-2">Follow up</div>
          <div className="flex flex-wrap gap-1.5">
            {(response.followups ?? []).map(q => (
              <button
                key={q}
                onClick={() => onAsk(q)}
                className="text-[11px] px-2.5 py-1 bg-bg-2 border border-border rounded-full text-text-2 hover:text-text-1 hover:border-border-strong"
              >{q}</button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function EntitiesRow({
  entities,
  onOpen
}: {
  entities: Entity[];
  onOpen: (slug: string) => void;
}) {
  return (
    <section className="mb-4">
      <div className="text-[11px] uppercase tracking-wide text-text-3 mb-2">People & Entities</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {entities.map(e => {
          const meta = (e.metadata ?? {}) as Record<string, unknown>;
          const description = typeof meta.description === "string" ? meta.description : "";
          const role = typeof meta.role === "string" ? meta.role : "";
          return (
            <button
              key={e.slug}
              onClick={() => onOpen(e.slug)}
              className="bg-bg-1 border border-border rounded-lg p-3 text-left hover:border-border-strong"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm text-text-1">{e.name}</div>
                <div className="text-[10px] text-text-3">{e.kind}</div>
              </div>
              {role && <div className="text-[11px] text-text-3 mt-0.5">{role}</div>}
              {description && <div className="text-[12px] text-text-2 mt-2 line-clamp-3">{description}</div>}
              {!description && (
                <div className="text-[11px] text-text-4 italic mt-2">No profile yet — click to add details.</div>
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
    <section className="mb-4">
      <div className="text-[11px] uppercase tracking-wide text-text-3 mb-2">Projects</div>
      <div className="flex flex-wrap gap-2">
        {projects.map(p => (
          <div
            key={p.id}
            className="bg-bg-1 border border-border rounded-lg px-3 py-2 flex items-center gap-3"
          >
            <span className="w-2 h-2 rounded-full" style={{ background: p.color || "#888" }} />
            <div>
              <div className="text-sm font-semibold text-text-1">{p.name}</div>
              {p.description && <div className="text-[11px] text-text-3">{p.description}</div>}
            </div>
            <div className="text-[10px] text-text-4 ml-2">{p.memory_count} hit{p.memory_count === 1 ? "" : "s"}</div>
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
    return (
      <section className="text-text-3 text-sm py-6 text-center">
        No matching memories.
      </section>
    );
  }

  return (
    <>
      {dedupedPrinciples.length > 0 && (
        <section className="mb-4">
          <div className="text-[11px] uppercase tracking-wide text-text-3 mb-2">Relevant principles</div>
          <div className="space-y-2">
            {dedupedPrinciples.map(m => (
              <button key={m.id} onClick={() => onPick(m)} className="mem-card w-full text-left">
                <div className="text-sm font-medium">{m.summary || m.content.slice(0, 140)}</div>
                <div className="text-[11px] text-text-3 mt-1">
                  {m.type} · importance {Math.round((m.importance_score ?? 0) * 100)}%
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mb-4">
        <div className="text-[11px] uppercase tracking-wide text-text-3 mb-2">Top memories ({memories.length})</div>
        <div className="space-y-2">
          {memories.map(m => (
            <button key={m.id} onClick={() => onPick(m)} className="mem-card w-full text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-1">{m.summary || m.content.slice(0, 160)}</div>
                  <div className="text-[11px] text-text-3 mt-1 flex items-center gap-2 flex-wrap">
                    <span>{m.type}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                    {m.why && <><span>·</span><span className="text-text-4">{m.why}</span></>}
                    {principleIds.has(m.id) && <><span>·</span><span className="text-accent">principle</span></>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-text-4 shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function ContextPackToggle({
  show,
  onToggle,
  markdown
}: {
  show: boolean;
  onToggle: () => void;
  markdown: string;
}) {
  return (
    <section className="mb-8">
      <button
        onClick={onToggle}
        className="inline-flex items-center gap-2 text-[12px] text-text-3 hover:text-text-1"
      >
        {show ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <FileText className="w-3.5 h-3.5" />
        {show ? "Hide" : "Show"} full context pack (what AI saw)
      </button>
      {show && (
        <pre className="mt-3 whitespace-pre-wrap text-xs text-text-2 leading-relaxed font-mono max-h-[480px] overflow-y-auto bg-bg-1 border border-border rounded-lg p-4">
          {markdown}
        </pre>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <section className="text-text-3 text-sm py-12">
      <div className="max-w-md mx-auto text-center space-y-3">
        <BrainCircuit className="w-10 h-10 text-text-4 mx-auto" />
        <div className="text-text-2">Ask Mnemos a question.</div>
        <div className="text-[12px] text-text-4">
          Try asking about a person (&quot;Who is Daylon?&quot;), a project (&quot;UDT Glendale stack&quot;), or an incident
          (&quot;May 1 incident&quot;). Mnemos will pull only the relevant memories, then compose a direct answer.
        </div>
      </div>
    </section>
  );
}
