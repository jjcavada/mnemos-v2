import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createEmbedding, distillCapture, hasOpenAIKey, type DistilledCapture, type DistilledEntity } from "@/lib/openai-memory";
import {
  clampImportance,
  coerceLifeArea,
  coerceMemorySource,
  coerceMemoryType,
  normalizeTags,
  slugify
} from "@/lib/mnemos-schema";
import type { Memory, MemorySource, MemoryType, Project } from "@/lib/types";

type JsonObject = Record<string, unknown>;
const MEMORY_SELECT = [
  "id",
  "content",
  "summary",
  "type",
  "status",
  "source",
  "project_id",
  "tags",
  "source_url",
  "source_metadata",
  "retrieval_count",
  "last_retrieved_at",
  "importance_score",
  "created_at",
  "updated_at",
  "created_by",
  "life_area",
  "is_project",
  "entities",
  "mood",
  "occurred_at"
].join(",");

export type CaptureChatBody = {
  text?: string;
  title?: string;
  source?: MemorySource;
  project?: string;
  project_id?: string;
  life_area?: string;
  is_project?: boolean;
  tags?: string[];
  participants?: string[];
  importance?: number;
  occurred_at?: string;
  keep_raw?: boolean;
};

export type CaptureResult = {
  capture_id: string;
  raw_memory_id: string | null;
  inserted: Memory[];
  questions: Array<{ id: string; prompt: string }>;
  distillation: DistilledCapture;
  degraded: {
    openai_missing: boolean;
    service_role_missing: boolean;
  };
};

export type SearchFilters = {
  project?: string;
  project_id?: string;
  type?: string;
  tags?: string[];
  life_area?: string;
  is_project?: boolean;
};

export type MemorySearchResult = Memory & {
  rank?: number;
  score?: number;
  similarity?: number;
  fts_rank?: number;
  why?: string;
};

export function envReport() {
  return {
    supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabase_anon_key: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabase_service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    openai_api_key: hasOpenAIKey()
  };
}

export function serverSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = service || anon;
  if (!url || !key) {
    throw new Error("Supabase URL and either service role or anon key are required");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function captureChat(body: CaptureChatBody): Promise<CaptureResult> {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 3) throw new Error("Capture text is required");

  const sb = serverSupabase();
  const captureId = crypto.randomUUID();
  const source = coerceMemorySource(body.source, "claude-code");
  const providedTags = normalizeTags(body.tags ?? []);
  const isProject = typeof body.is_project === "boolean" ? body.is_project : Boolean(body.project || body.project_id);
  const project = await resolveProject(sb, body.project_id, body.project);
  const lifeArea = isProject ? null : (coerceLifeArea(body.life_area) ?? "other");
  const occurredAt = normalizeDate(body.occurred_at);

  const distillation = await distillCapture({
    text,
    title: body.title ?? null,
    source,
    project: body.project ?? project?.slug ?? null,
    lifeArea,
    isProject,
    tags: providedTags,
    participants: Array.isArray(body.participants) ? body.participants.filter(isString) : []
  });

  await upsertEntities(sb, allEntities(distillation));

  const rawMemoryId = body.keep_raw === false
    ? null
    : await insertMemory(sb, {
        content: text,
        summary: body.title || `Raw capture ${new Date().toISOString().slice(0, 10)}`,
        type: coerceMemoryType(isProject ? "meeting-note" : "reflection"),
        source,
        project_id: project?.id ?? body.project_id ?? null,
        tags: [...new Set(["raw-capture", ...providedTags])],
        source_metadata: {
          capture_id: captureId,
          capture_kind: "raw_chat",
          participants: body.participants ?? [],
          project_slug: body.project ?? project?.slug ?? null,
          distilled_count: distillation.memories.length
        },
        importance_score: clampImportance(body.importance, 0.45),
        life_area: lifeArea,
        is_project: isProject,
        entities: [],
        mood: null,
        occurred_at: occurredAt
      });

  const inserted: Memory[] = [];
  for (const m of distillation.memories) {
    const memoryProject = m.project_slug
      ? await resolveProject(sb, null, m.project_slug)
      : project;
    const rowId = await insertMemory(sb, {
      content: m.content,
      summary: m.summary,
      type: m.type,
      source,
      project_id: memoryProject?.id ?? (m.is_project ? body.project_id ?? project?.id ?? null : null),
      tags: [...new Set([...m.tags, ...providedTags])],
      source_metadata: {
        capture_id: captureId,
        capture_kind: "distilled_chat",
        raw_memory_id: rawMemoryId,
        question: m.question,
        project_slug: m.project_slug ?? body.project ?? project?.slug ?? null
      },
      importance_score: clampImportance(m.importance_score, body.importance ?? 0.7),
      life_area: m.is_project ? null : (m.life_area ?? lifeArea ?? "other"),
      is_project: m.is_project,
      entities: m.entities.map(e => e.slug),
      mood: m.mood,
      occurred_at: m.occurred_at ?? occurredAt
    });
    const row = await getMemory(sb, rowId);
    if (row) inserted.push(row);
    if (rawMemoryId) await linkMemories(sb, rawMemoryId, rowId, "distilled_into", 0.95);
  }

  await linkDistilledMemories(sb, inserted, distillation);
  const questions = await insertQuestions(sb, distillation, inserted, source);

  return {
    capture_id: captureId,
    raw_memory_id: rawMemoryId,
    inserted,
    questions,
    distillation,
    degraded: {
      openai_missing: !hasOpenAIKey(),
      service_role_missing: !process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  };
}

export async function searchMemories(
  query: string,
  k = 12,
  filters: SearchFilters = {},
  options: { allowEmbedding?: boolean } = {}
): Promise<MemorySearchResult[]> {
  const sb = serverSupabase();
  const cleanQuery = query.trim();
  const limit = Math.max(1, Math.min(k, 50));
  const project = await resolveProject(sb, filters.project_id, filters.project);

  let rpcRows: MemorySearchResult[] | null = null;
  if (cleanQuery && options.allowEmbedding) {
    const embedding = await createEmbedding(cleanQuery);
    if (embedding) {
      const { data, error } = await sb.rpc("search_memories", {
        query_text: cleanQuery,
        query_embedding: embedding,
        filter_tags: normalizeTags(filters.tags ?? []),
        filter_project_slug: filters.project ?? null,
        filter_type: filters.type ?? null,
        match_count: limit * 3
      });
      if (!error && Array.isArray(data)) rpcRows = data as MemorySearchResult[];
    }
  }

  const fallbackRows = await fallbackSearch(sb, cleanQuery, limit * 4);
  const rows = mergeSearchRows(rpcRows ?? [], fallbackRows);
  return rows
    .filter(m => matchesFilters(m, filters, project?.id ?? filters.project_id))
    .map(m => ({ ...stripHeavyFields(m), why: explainMatch(m, cleanQuery) }))
    .slice(0, limit);
}

function mergeSearchRows(primary: MemorySearchResult[], fallback: MemorySearchResult[]) {
  const seen = new Set<string>();
  const merged: MemorySearchResult[] = [];
  for (const row of [...primary, ...fallback]) {
    if (!row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

export async function buildContextPack(query: string, k = 10, filters: SearchFilters = {}) {
  const results = await searchMemories(query, k, filters);
  const sb = serverSupabase();
  const { data: principles } = await sb
    .from("memories")
    .select("*")
    .in("type", ["belief", "principle", "pattern"])
    .eq("status", "active")
    .order("importance_score", { ascending: false })
    .limit(8);

  return [
    "# Mnemos Context Pack",
    "",
    `Query: ${query || "(general)"}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Jay Defaults",
    ...((principles ?? []) as Memory[]).map(m => `- ${m.summary || m.content.slice(0, 180)}`),
    "",
    "## Relevant Memories",
    ...results.map((m, i) => [
      `${i + 1}. ${m.summary || m.content.slice(0, 180)}`,
      `   id: ${m.id}`,
      `   type: ${m.type}; source: ${m.source}; created: ${m.created_at}`,
      `   tags: ${(m.tags ?? []).join(", ") || "none"}`,
      `   content: ${m.content.slice(0, 700).replace(/\s+/g, " ")}`
    ].join("\n"))
  ].join("\n");
}

export async function exportArchive(format: "bundle" | "jsonl" = "bundle") {
  const sb = serverSupabase();
  const [memories, relationships, projects, lifeAreas, entities, questions, journals, interests] = await Promise.all([
    selectAll(sb, "memories"),
    selectAll(sb, "relationships"),
    selectAll(sb, "projects"),
    selectAll(sb, "life_areas"),
    selectAll(sb, "entities"),
    selectAll(sb, "questions"),
    selectAll(sb, "journals"),
    selectAll(sb, "interests")
  ]);

  if (format === "jsonl") {
    return {
      contentType: "application/x-ndjson; charset=utf-8",
      body: memories.map(row => JSON.stringify(row)).join("\n") + "\n"
    };
  }

  const files = [
    { path: "schema.md", content: schemaMarkdown(), mime: "text/markdown" },
    { path: "jay-profile.md", content: profileMarkdown(memories as Memory[]), mime: "text/markdown" },
    { path: "open-questions.md", content: questionsMarkdown(memories as Memory[], questions), mime: "text/markdown" },
    { path: "projects.json", content: JSON.stringify(projects, null, 2), mime: "application/json" },
    { path: "people-and-entities.json", content: JSON.stringify(entities, null, 2), mime: "application/json" },
    { path: "relationships.json", content: JSON.stringify(relationships, null, 2), mime: "application/json" },
    { path: "life-areas.json", content: JSON.stringify(lifeAreas, null, 2), mime: "application/json" },
    { path: "journals.json", content: JSON.stringify(journals, null, 2), mime: "application/json" },
    { path: "interests.json", content: JSON.stringify(interests, null, 2), mime: "application/json" },
    { path: "memories.jsonl", content: memories.map(row => JSON.stringify(row)).join("\n") + "\n", mime: "application/x-ndjson" }
  ];

  return {
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({ exported_at: new Date().toISOString(), files }, null, 2)
  };
}

export async function dailyDigest() {
  const sb = serverSupabase();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await sb
    .from("memories")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  const { data: open } = await sb
    .from("memories")
    .select("*")
    .in("type", ["todo", "reminder", "question"])
    .eq("status", "active")
    .order("importance_score", { ascending: false })
    .limit(20);

  return {
    generated_at: new Date().toISOString(),
    since,
    counts: {
      recent: recent?.length ?? 0,
      open_followups: open?.length ?? 0
    },
    recent: ((recent ?? []) as Memory[]).map(compactMemory),
    open_followups: ((open ?? []) as Memory[]).map(compactMemory)
  };
}

async function insertMemory(sb: SupabaseClient, payload: JsonObject): Promise<string> {
  const embedding = await createEmbedding(String(payload.content ?? ""));
  const row = embedding ? { ...payload, embedding } : payload;
  const { data, error } = await sb.from("memories").insert(row).select("id").single();
  if (error) throw new Error(`Insert memory failed: ${error.message}`);
  return (data as { id: string }).id;
}

async function getMemory(sb: SupabaseClient, id: string): Promise<Memory | null> {
  const { data } = await sb.from("memories").select(MEMORY_SELECT).eq("id", id).maybeSingle();
  return data as Memory | null;
}

async function resolveProject(sb: SupabaseClient, id?: string | null, slug?: string | null): Promise<Project | null> {
  if (id) {
    const { data } = await sb.from("projects").select("*").eq("id", id).maybeSingle();
    if (data) return data as Project;
  }
  if (slug) {
    const { data } = await sb.from("projects").select("*").eq("slug", slugify(slug)).maybeSingle();
    if (data) return data as Project;
  }
  return null;
}

async function upsertEntities(sb: SupabaseClient, entities: DistilledEntity[]) {
  if (!entities.length) return;
  const rows = entities.map(e => ({
    slug: e.slug,
    name: e.name,
    kind: e.kind,
    metadata: {}
  }));
  await sb.from("entities").upsert(rows, { onConflict: "slug", ignoreDuplicates: false });
}

function allEntities(distillation: DistilledCapture) {
  const seen = new Set<string>();
  const out: DistilledEntity[] = [];
  for (const m of distillation.memories) {
    for (const e of m.entities) {
      if (seen.has(e.slug)) continue;
      seen.add(e.slug);
      out.push(e);
    }
  }
  return out;
}

async function insertQuestions(sb: SupabaseClient, distillation: DistilledCapture, inserted: Memory[], source: MemorySource) {
  const rows = [
    ...distillation.questions.map(q => ({ prompt: q.prompt, source, answer_ref: null })),
    ...inserted
      .filter(m => m.type === "question")
      .map(m => ({ prompt: m.summary || m.content, source, answer_ref: m.id }))
  ];
  if (!rows.length) return [];
  const { data } = await sb.from("questions").insert(rows).select("id,prompt");
  return (data ?? []) as Array<{ id: string; prompt: string }>;
}

async function linkDistilledMemories(sb: SupabaseClient, inserted: Memory[], distillation: DistilledCapture) {
  for (const link of distillation.links) {
    const from = inserted.find(m => (m.summary || m.content).includes(link.from_summary));
    const to = inserted.find(m => (m.summary || m.content).includes(link.to_summary));
    if (from && to && from.id !== to.id) {
      await linkMemories(sb, from.id, to.id, link.relation_type, link.weight);
    }
  }
}

async function linkMemories(sb: SupabaseClient, from: string, to: string, relationType: string, weight: number) {
  await sb.from("relationships").insert({
    from_memory: from,
    to_memory: to,
    relation_type: relationType,
    weight
  });
}

async function fallbackSearch(sb: SupabaseClient, query: string, limit: number): Promise<MemorySearchResult[]> {
  const req = sb.from("memories").select(MEMORY_SELECT).eq("status", "active").limit(1000);
  const { data, error } = await req;
  if (error) throw new Error(`Fallback search failed: ${error.message}`);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return ((data ?? []) as unknown as Memory[])
    .map(m => ({ ...m, score: keywordScore(m, terms) }))
    .filter(m => !terms.length || (m.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.importance_score ?? 0) - (a.importance_score ?? 0))
    .slice(0, limit);
}

function stripHeavyFields(row: MemorySearchResult): MemorySearchResult {
  const copy = { ...row } as MemorySearchResult & { embedding?: unknown; fts?: unknown };
  delete copy.embedding;
  delete copy.fts;
  return copy;
}

function matchesFilters(m: Memory, filters: SearchFilters, projectId?: string | null) {
  if (projectId && m.project_id !== projectId) return false;
  if (filters.type && m.type !== coerceMemoryType(filters.type, m.type)) return false;
  if (typeof filters.is_project === "boolean" && m.is_project !== filters.is_project) return false;
  if (filters.life_area && m.life_area !== coerceLifeArea(filters.life_area)) return false;
  const tags = normalizeTags(filters.tags ?? []);
  if (tags.length && !tags.every(t => m.tags?.includes(t))) return false;
  return true;
}

function keywordScore(m: Memory, terms: string[]) {
  const text = `${m.summary ?? ""} ${m.content} ${(m.tags ?? []).join(" ")} ${m.life_area ?? ""}`.toLowerCase();
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0) + (m.importance_score ?? 0);
}

function explainMatch(m: Memory, query: string) {
  if (!query.trim()) return "recent important memory";
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = `${m.summary ?? ""} ${m.content} ${(m.tags ?? []).join(" ")}`.toLowerCase();
  const hits = terms.filter(t => hay.includes(t)).slice(0, 6);
  return hits.length ? `matched: ${hits.join(", ")}` : "semantic match";
}

async function selectAll(sb: SupabaseClient, table: string) {
  const { data, error } = await sb.from(table).select("*").limit(10000);
  if (error) throw new Error(`Export failed for ${table}: ${error.message}`);
  return data ?? [];
}

function compactMemory(m: Memory) {
  return {
    id: m.id,
    summary: m.summary,
    type: m.type,
    tags: m.tags,
    created_at: m.created_at,
    content: m.content.slice(0, 500)
  };
}

function schemaMarkdown() {
  return [
    "# Mnemos Archive Schema",
    "",
    "The durable source of truth is `memories.jsonl`; embeddings are rebuildable cache.",
    "Each memory contains content, summary, type, source, project_id, tags, importance_score, timestamps, life_area, is_project, entities, mood, and occurred_at.",
    "Relationships are directed edges between memory IDs. Projects and life areas provide taxonomy."
  ].join("\n");
}

function profileMarkdown(memories: Memory[]) {
  const profileTypes = new Set<MemoryType>(["belief", "principle", "pattern", "reflection"]);
  const rows = memories
    .filter(m => profileTypes.has(m.type))
    .sort((a, b) => (b.importance_score ?? 0) - (a.importance_score ?? 0))
    .slice(0, 80);
  return ["# Jay Profile", "", ...rows.map(m => `- ${m.summary || m.content.slice(0, 240)}`)].join("\n");
}

function questionsMarkdown(memories: Memory[], questions: unknown[]) {
  const memoryQuestions = memories.filter(m => m.type === "question");
  return [
    "# Open Questions",
    "",
    ...memoryQuestions.map(m => `- ${m.summary || m.content.slice(0, 240)} (${m.id})`),
    "",
    "## Question Table",
    "```json",
    JSON.stringify(questions, null, 2),
    "```"
  ].join("\n");
}

function normalizeDate(input: unknown): string | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
