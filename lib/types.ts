export type MemoryType =
  | "fact" | "decision" | "bug-fix" | "pattern" | "workflow"
  | "learning" | "prompt" | "client-info" | "meeting-note"
  | "idea" | "reference" | "question" | "endeavor" | "reminder"
  | "todo" | "milestone" | "asset"
  | "belief" | "principle" | "reflection" | "journal";

export type MemorySource =
  | "manual" | "retell" | "make" | "n8n"
  | "claude-code" | "claude-cowork" | "browser-ext" | "email" | "webhook";

export type Memory = {
  id: string;
  content: string;
  summary: string | null;
  type: MemoryType;
  status: string;
  source: MemorySource;
  project_id: string | null;
  life_area: string | null;
  is_project: boolean;
  entities: string[];
  mood: string | null;
  tags: string[];
  source_url: string | null;
  source_metadata: Record<string, unknown>;
  importance_score: number;
  retrieval_count: number;
  occurred_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined client-side from projects table
  project?: Project | null;
};

export type Relationship = {
  id: string;
  from_memory: string;
  to_memory: string;
  relation_type: string;
  weight: number;
  created_at: string;
};

export type LifeArea = {
  slug: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
};

export type Project = {
  id: string;
  slug: string;
  name: string;
  color: string;
  description: string | null;
  parent_id: string | null;
};

export type Asset = {
  id: string;
  memory_id: string;
  storage_url: string;
  mime_type: string;
  filename: string | null;
  created_at: string;
};

export type Journal = {
  id: string;
  date: string;
  win: string | null;
  lesson: string | null;
  followup: string | null;
  mood: string | null;
  energy: number | null;
  raw_text: string | null;
  created_at: string;
};

export type Entity = {
  id: string;
  slug: string;
  name: string;
  kind: "person" | "place" | "organization" | "book" | "tool" | "concept" | "event" | "other";
  metadata: Record<string, unknown>;
};
