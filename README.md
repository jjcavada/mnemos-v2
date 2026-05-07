# mnemos v2 — Second Brain

Next.js 15 + React 19 + Supabase + react-force-graph. Greyscale-default coloring, Life Areas, Journal, Timeline, People, 2D + 3D graph.

---

## 1. Install

```bash
cd mnemos-v2
npm install
cp .env.local.example .env.local
# paste your SUPABASE_SERVICE_ROLE_KEY into .env.local
```

The anon key + URL are pre-filled (same Supabase as v1).

## 2. Database migration — ALREADY APPLIED to live Supabase

The migration in `migrations/002_second_brain_expansion.sql` was applied via Supabase MCP.

Result on prod (verified):
- `is_project=true`: **67** memories
- `is_project=false`: **4** memories
- `life_areas` seeded: **11** rows
- `journals`, `entities`, `questions`, `interests`: 0 rows (empty, ready to fill)

Schema additions on `memories`: `life_area`, `is_project`, `entities`, `mood`, `occurred_at`.
New tables: `entities`, `journals`, `questions`, `interests`, `life_areas`.
New memory types: `belief`, `principle`, `reflection`, `journal` (`question` already existed).

If you need to re-run on a fresh DB: paste the migration file into Supabase SQL Editor.

## 3. Local dev

```bash
npm run dev
# open http://localhost:3000
```

## 4. Deploy to Vercel

### Option A — via CLI (fastest)

```bash
npm i -g vercel
vercel login
vercel --prod
```

When prompted:
- Framework: Next.js (auto-detected)
- Root directory: `./`
- Build command: `next build` (default)
- Add env vars when asked, or do it after via dashboard.

### Option B — via Vercel dashboard

1. Push this folder to a new GitHub repo (`mnemos-v2`)
2. https://vercel.com/new → import the repo
3. Framework preset: **Next.js**
4. Add env vars:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://gxcqwolbwhnqgdkzmmyl.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon publishable key
   - `SUPABASE_SERVICE_ROLE_KEY` = from Supabase Settings → API
   - `OPENAI_API_KEY` = (optional, only for embedding endpoint in Phase 2)
5. Deploy.

Vercel gives you `mnemos-v2-<random>.vercel.app` immediately. Add a custom domain later in Project Settings → Domains.

### Keep v1 alive during cutover

Don't touch the existing Netlify deployment. Validate v2 on Vercel first. When you're happy, point your primary domain at Vercel and decommission Netlify.

## 5. Project structure

```
mnemos-v2/
├── app/                    Next.js App Router pages
│   ├── graph/              2D + 3D force graph
│   ├── timeline/           Vertical month-grouped scroll
│   ├── journal/            Daily reflection (win/lesson/followup)
│   ├── people/             Entities (people, places, books, tools)
│   ├── list/               Flat list view
│   └── api/                Server endpoints (auto-capture goes here)
├── components/             Reusable React components
│   ├── Header.tsx          Top nav + search
│   ├── Sidebar.tsx         Spaces, Life Areas, Projects, Types, Tags
│   ├── DailyBrief.tsx      Today / Yesterday / 7d / open follow-ups
│   ├── MemoryDrawer.tsx    Right-side detail panel with edit + delete
│   ├── Graph2D.tsx         react-force-graph-2d
│   └── Graph3D.tsx         react-force-graph-3d
├── lib/
│   ├── types.ts            TypeScript types matching DB schema
│   ├── supabase.ts         Browser client (anon key)
│   ├── supabase-server.ts  Server client (service role)
│   └── colors.ts           memoryColor() — greyscale rule lives here
├── store/
│   └── memories.ts         Zustand store + applyFilters()
└── migrations/
    └── 002_second_brain_expansion.sql
```

## 6. Coloring rule

Implemented in `lib/colors.ts`:

```ts
if (!m.is_project) return LIFE_GREY; // #4a4a52
return projectsById[m.project_id]?.color ?? LIFE_GREY;
```

To change: edit `LIFE_GREY` or per-project colors in the `projects` table.

## 7. Phase 2 (next)

Auto-capture endpoints to add in `app/api/`:
- `POST /api/capture/chat` — Claude conversation summarizer
- `POST /api/capture/voice` — Whisper transcription pipeline
- `POST /api/capture/highlight` — browser-extension save target
- `GET  /api/digest/daily` — generate daily brief from past 24h

These will use `lib/supabase-server.ts` with the service role key so they bypass RLS.

## 8. Differences from v1 (vanilla)

| | v1 (vanilla) | v2 (Next.js) |
|---|---|---|
| State | Globals | Zustand store |
| Routing | Tab toggle | Real URLs (`/graph`, `/journal`, ...) |
| Tailwind | CDN JIT | Compiled at build |
| Type safety | None | TypeScript strict |
| Graph | DOM-mounted force-graph | `react-force-graph-2d` + `-3d` |
| Auto-capture | None | Server endpoints (Phase 2) |
| Hosting | Netlify | Vercel |

## 9. Troubleshooting

**"Module not found: @supabase/ssr"** → run `npm install` in `mnemos-v2/`

**"Failed to fetch memories"** → migration not run, or anon key wrong in `.env.local`

**Empty graph after migration** → run the verification query in step 2; if `project_memories=0`, the backfill clause didn't match. Manually: `UPDATE memories SET is_project=TRUE WHERE project_slug NOT IN ('personal','life');`

**3D mode is laggy** → Force-graph-3d has GPU cost. Toggle back to 2D for sets >500 nodes.
