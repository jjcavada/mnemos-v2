# Mnemos Phase 2 Memory API

These routes turn v2 from a dashboard into an ingestion and recall surface.

## Required env

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` for trusted server writes; routes can fall back to anon RLS where policies allow it
- `OPENAI_API_KEY` for distillation and embeddings
- `OPENAI_DISTILL_MODEL` optional; defaults to `gpt-4o-mini`

Without `OPENAI_API_KEY`, capture still stores raw text, but distilled memories and embeddings degrade to deterministic fallback.

## Capture

`POST /api/capture/chat`

```json
{
  "title": "Daylon / UDT Glendale issue",
  "text": "Raw chat or note text...",
  "source": "claude-code",
  "project": "udt-glendale",
  "is_project": true,
  "tags": ["daylon", "udt-glendale"]
}
```

Behavior:

- saves the raw source as a `raw-capture` memory
- distills atomic memories using OpenAI structured output
- embeds each memory with `text-embedding-3-small`
- links distilled memories back to the raw source with `distilled_into`
- inserts extracted questions into `questions`
- upserts extracted entities into `entities`

`POST /api/capture/highlight` wraps the same pipeline for browser highlights.

`POST /api/capture/voice` accepts a `transcript` form field for now. Audio transcription is intentionally not wired yet.

## Recall

`POST /api/search`

```json
{
  "query": "Do you remember the Daylon UDT Glendale issue?",
  "k": 12,
  "filter": {
    "project": "udt-glendale",
    "tags": ["daylon"]
  }
}
```

Behavior:

- with `OPENAI_API_KEY`, embeds the query and calls `search_memories_hybrid`
- without `OPENAI_API_KEY`, falls back to server keyword scoring

`POST /api/context` returns a Markdown context pack for pasting into a future AI session.

## Export

`GET /api/export` returns a portable JSON archive with virtual files:

- `memories.jsonl`
- `jay-profile.md`
- `open-questions.md`
- `projects.json`
- `relationships.json`
- `people-and-entities.json`
- `schema.md`

`GET /api/export?format=jsonl` returns only newline-delimited memories.

## Claude/Codex auto-update

This chat is not automatically written to mnemos by default. Auto-update requires an agent or MCP tool to call `POST /api/capture/chat` after a meaningful conversation, or the existing `C:\mnemos` MCP server to call `store_memory`.

Recommended protocol:

1. At the end of a useful chat, summarize the durable facts, decisions, questions, preferences, and project gotchas.
2. POST the raw transcript plus summary context to `/api/capture/chat`.
3. Use `project` for project-scoped work; use `life_area` and `is_project:false` for personal memories.
4. Use `POST /api/search` or the MCP `search_memories` tool before answering context-heavy questions.
