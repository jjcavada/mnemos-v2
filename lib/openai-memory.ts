import {
  coerceEntityKind,
  coerceLifeArea,
  coerceMemoryType,
  normalizeTags,
  slugify,
  type EntityKind
} from "@/lib/mnemos-schema";
import type { MemoryType } from "@/lib/types";

const OPENAI_API = "https://api.openai.com/v1";
const DEFAULT_DISTILL_MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-small";

export type DistilledEntity = {
  slug: string;
  name: string;
  kind: EntityKind;
};

export type DistilledMemory = {
  content: string;
  summary: string | null;
  type: MemoryType;
  tags: string[];
  life_area: string | null;
  is_project: boolean;
  project_slug: string | null;
  entities: DistilledEntity[];
  mood: string | null;
  occurred_at: string | null;
  importance_score: number;
  question: string | null;
};

export type DistilledCapture = {
  profile_insights: string[];
  memories: DistilledMemory[];
  questions: Array<{ prompt: string; tags: string[]; answer_summary: string | null }>;
  links: Array<{ from_summary: string; to_summary: string; relation_type: string; weight: number }>;
};

type CaptureDistillInput = {
  text: string;
  title?: string | null;
  source?: string | null;
  project?: string | null;
  lifeArea?: string | null;
  isProject?: boolean | null;
  tags?: string[];
  participants?: string[];
};

function apiKey() {
  return process.env.OPENAI_API_KEY;
}

export function hasOpenAIKey() {
  return Boolean(apiKey());
}

export async function createEmbedding(input: string): Promise<number[] | null> {
  const key = apiKey();
  if (!key) return null;

  const res = await fetch(`${OPENAI_API}/embeddings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: truncateForEmbedding(input),
      encoding_format: "float"
    })
  });

  if (!res.ok) {
    throw new Error(`OpenAI embeddings failed: ${await res.text()}`);
  }

  const json = await res.json() as { data?: Array<{ embedding?: number[] }> };
  return json.data?.[0]?.embedding ?? null;
}

export async function distillCapture(input: CaptureDistillInput): Promise<DistilledCapture> {
  const key = apiKey();
  if (!key) return fallbackDistillation(input);

  const res = await fetch(`${OPENAI_API}/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_DISTILL_MODEL || DEFAULT_DISTILL_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You distill Jay's second-brain memories.",
                "Extract durable, atomic memories from raw chat or notes.",
                "Preserve Jay's voice, beliefs, decisions, questions, project context, people, jargon, and unresolved loops.",
                "Do not invent facts. Prefer fewer high-signal memories over many vague ones.",
                "Use is_project=false for life/philosophy/journal material; use is_project=true only for explicit project/client/build work.",
                "Use life_area only for non-project memories."
              ].join(" ")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                title: input.title ?? null,
                source: input.source ?? null,
                preferred_project_slug: input.project ?? null,
                preferred_life_area: input.lifeArea ?? null,
                preferred_is_project: input.isProject ?? null,
                provided_tags: input.tags ?? [],
                participants: input.participants ?? [],
                raw_text: input.text
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "mnemos_distillation",
          strict: true,
          schema: distillationSchema
        }
      },
      max_output_tokens: 6000
    })
  });

  if (!res.ok) {
    throw new Error(`OpenAI distillation failed: ${await res.text()}`);
  }

  const json = await res.json();
  const parsed = JSON.parse(extractOutputText(json));
  return normalizeDistillation(parsed, input);
}

const distillationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    profile_insights: {
      type: "array",
      items: { type: "string" }
    },
    memories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          content: { type: "string" },
          summary: { type: ["string", "null"] },
          type: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          life_area: { type: ["string", "null"] },
          is_project: { type: "boolean" },
          project_slug: { type: ["string", "null"] },
          entities: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                slug: { type: "string" },
                name: { type: "string" },
                kind: { type: "string" }
              },
              required: ["slug", "name", "kind"]
            }
          },
          mood: { type: ["string", "null"] },
          occurred_at: { type: ["string", "null"] },
          importance_score: { type: "number" },
          question: { type: ["string", "null"] }
        },
        required: [
          "content",
          "summary",
          "type",
          "tags",
          "life_area",
          "is_project",
          "project_slug",
          "entities",
          "mood",
          "occurred_at",
          "importance_score",
          "question"
        ]
      }
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          prompt: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          answer_summary: { type: ["string", "null"] }
        },
        required: ["prompt", "tags", "answer_summary"]
      }
    },
    links: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          from_summary: { type: "string" },
          to_summary: { type: "string" },
          relation_type: { type: "string" },
          weight: { type: "number" }
        },
        required: ["from_summary", "to_summary", "relation_type", "weight"]
      }
    }
  },
  required: ["profile_insights", "memories", "questions", "links"]
};

function normalizeDistillation(raw: any, input: CaptureDistillInput): DistilledCapture {
  const baseTags = normalizeTags(input.tags ?? []);
  const preferredLifeArea = coerceLifeArea(input.lifeArea);
  const preferredProject = input.project ? slugify(input.project) : null;

  return {
    profile_insights: Array.isArray(raw.profile_insights)
      ? raw.profile_insights.filter((v: unknown) => typeof v === "string").slice(0, 12)
      : [],
    memories: Array.isArray(raw.memories)
      ? raw.memories
          .filter((m: any) => typeof m?.content === "string" && m.content.trim())
          .slice(0, 24)
          .map((m: any) => {
            const isProject = typeof input.isProject === "boolean" ? input.isProject : Boolean(m.is_project);
            return {
              content: m.content.trim(),
              summary: typeof m.summary === "string" && m.summary.trim() ? m.summary.trim() : null,
              type: coerceMemoryType(m.type, isProject ? "learning" : "reflection"),
              tags: normalizeTags([...(m.tags ?? []), ...baseTags]),
              life_area: isProject ? null : (coerceLifeArea(m.life_area) ?? preferredLifeArea ?? "other"),
              is_project: isProject,
              project_slug: isProject ? (typeof m.project_slug === "string" ? slugify(m.project_slug) : preferredProject) : null,
              entities: normalizeEntities(m.entities),
              mood: typeof m.mood === "string" && m.mood.trim() ? m.mood.trim().slice(0, 80) : null,
              occurred_at: normalizeDate(m.occurred_at),
              importance_score: clampNumber(m.importance_score, 0.7),
              question: typeof m.question === "string" && m.question.trim() ? m.question.trim() : null
            };
          })
      : [],
    questions: Array.isArray(raw.questions)
      ? raw.questions
          .filter((q: any) => typeof q?.prompt === "string" && q.prompt.trim())
          .slice(0, 20)
          .map((q: any) => ({
            prompt: q.prompt.trim(),
            tags: normalizeTags([...(q.tags ?? []), ...baseTags]),
            answer_summary: typeof q.answer_summary === "string" && q.answer_summary.trim() ? q.answer_summary.trim() : null
          }))
      : [],
    links: Array.isArray(raw.links)
      ? raw.links
          .filter((l: any) => typeof l?.from_summary === "string" && typeof l?.to_summary === "string")
          .slice(0, 30)
          .map((l: any) => ({
            from_summary: l.from_summary,
            to_summary: l.to_summary,
            relation_type: typeof l.relation_type === "string" ? l.relation_type.slice(0, 80) : "related",
            weight: clampNumber(l.weight, 0.7)
          }))
      : []
  };
}

function fallbackDistillation(input: CaptureDistillInput): DistilledCapture {
  const isProject = Boolean(input.isProject || input.project);
  const summary = input.title || firstSentence(input.text);
  return {
    profile_insights: [],
    memories: [
      {
        content: input.text.trim(),
        summary,
        type: isProject ? "meeting-note" : "reflection",
        tags: normalizeTags(input.tags ?? []),
        life_area: isProject ? null : (coerceLifeArea(input.lifeArea) ?? "other"),
        is_project: isProject,
        project_slug: input.project ? slugify(input.project) : null,
        entities: [],
        mood: null,
        occurred_at: null,
        importance_score: 0.65,
        question: null
      }
    ],
    questions: [],
    links: []
  };
}

function normalizeEntities(input: unknown): DistilledEntity[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: DistilledEntity[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const name = typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim()
      : typeof raw.slug === "string" ? raw.slug.trim() : "";
    if (!name) continue;
    const slug = typeof raw.slug === "string" && raw.slug.trim() ? slugify(raw.slug) : slugify(name);
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, name, kind: coerceEntityKind(raw.kind) });
  }
  return out.slice(0, 20);
}

export type AnswerComposition = {
  answer: string;
  followups: string[];
  confidence: "high" | "medium" | "low";
  missing: string | null;
};

export async function composeAnswer(query: string, contextMarkdown: string): Promise<AnswerComposition | null> {
  const key = apiKey();
  if (!key) return null;

  const res = await fetch(`${OPENAI_API}/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_DISTILL_MODEL || DEFAULT_DISTILL_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You are Mnemos, Jay's second-brain answer engine.",
                "Use ONLY the provided memories, entity profiles, and project info to answer.",
                "Do not invent facts. Do not extrapolate beyond the context.",
                "Voice: peer-level technical, direct, no preamble, no apologies, no 'Based on the memories...'.",
                "Length: 2 to 5 sentences in the answer field. Tight, dense, useful.",
                "If the context partially answers, give the partial answer and put what's missing in the 'missing' field.",
                "If the context does not answer at all, set confidence='low' and put a one-line description of what's missing.",
                "followups: 2-4 specific follow-up questions Jay could ask Mnemos to drill deeper. Phrase as questions Jay would type, not generic prompts."
              ].join(" ")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Question: ${query}\n\n${contextMarkdown}`
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "mnemos_answer",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              answer: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              missing: { type: ["string", "null"] },
              followups: { type: "array", items: { type: "string" } }
            },
            required: ["answer", "confidence", "missing", "followups"]
          }
        }
      },
      max_output_tokens: 800
    })
  });

  if (!res.ok) return null;
  try {
    const json = await res.json();
    const parsed = JSON.parse(extractOutputText(json));
    return {
      answer: typeof parsed.answer === "string" ? parsed.answer.trim() : "",
      followups: Array.isArray(parsed.followups)
        ? parsed.followups.filter((s: unknown): s is string => typeof s === "string").slice(0, 5)
        : [],
      confidence: parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low",
      missing: typeof parsed.missing === "string" && parsed.missing.trim() ? parsed.missing.trim() : null
    };
  } catch {
    return null;
  }
}

function extractOutputText(json: any): string {
  if (typeof json.output_text === "string") return json.output_text;
  const chunks: string[] = [];
  for (const item of json.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  const text = chunks.join("");
  if (!text) throw new Error("OpenAI response did not include output text");
  return text;
}

function truncateForEmbedding(input: string) {
  return input.length > 24000 ? input.slice(0, 24000) : input;
}

function firstSentence(input: string) {
  return input.trim().split(/\n|(?<=[.!?])\s+/)[0]?.slice(0, 140) || "Captured memory";
}

function normalizeDate(input: unknown): string | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function clampNumber(input: unknown, fallback: number) {
  const n = typeof input === "number" && Number.isFinite(input) ? input : fallback;
  return Math.max(0.1, Math.min(1, Math.round(n * 100) / 100));
}
