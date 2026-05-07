import type { MemorySource, MemoryType } from "@/lib/types";

export const MEMORY_TYPES = [
  "fact",
  "decision",
  "bug-fix",
  "pattern",
  "workflow",
  "learning",
  "prompt",
  "client-info",
  "meeting-note",
  "idea",
  "reference",
  "question",
  "endeavor",
  "reminder",
  "todo",
  "milestone",
  "asset",
  "belief",
  "principle",
  "reflection",
  "journal"
] as const satisfies readonly MemoryType[];

export const MEMORY_SOURCES = [
  "manual",
  "retell",
  "make",
  "n8n",
  "claude-code",
  "claude-cowork",
  "browser-ext",
  "email",
  "webhook"
] as const satisfies readonly MemorySource[];

export const LIFE_AREAS = [
  "philosophy",
  "faith",
  "health",
  "money",
  "relationships",
  "career",
  "learning",
  "hobby",
  "family",
  "travel",
  "other"
] as const;

export const ENTITY_KINDS = [
  "person",
  "place",
  "organization",
  "book",
  "tool",
  "concept",
  "event",
  "other"
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export function coerceMemoryType(value: unknown, fallback: MemoryType = "reference"): MemoryType {
  return typeof value === "string" && (MEMORY_TYPES as readonly string[]).includes(value)
    ? (value as MemoryType)
    : fallback;
}

export function coerceMemorySource(value: unknown, fallback: MemorySource = "webhook"): MemorySource {
  return typeof value === "string" && (MEMORY_SOURCES as readonly string[]).includes(value)
    ? (value as MemorySource)
    : fallback;
}

export function coerceLifeArea(value: unknown): string | null {
  return typeof value === "string" && (LIFE_AREAS as readonly string[]).includes(value)
    ? value
    : null;
}

export function coerceEntityKind(value: unknown): EntityKind {
  return typeof value === "string" && (ENTITY_KINDS as readonly string[]).includes(value)
    ? (value as EntityKind)
    : "other";
}

export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const tag = raw.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-");
    if (tag) seen.add(tag.slice(0, 64));
  }
  return [...seen].slice(0, 18);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
}

export function clampImportance(value: unknown, fallback = 0.7): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0.1, Math.min(1, Math.round(n * 100) / 100));
}
