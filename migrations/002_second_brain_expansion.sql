-- =====================================================================
-- Mnemos v2: Second Brain Expansion (APPLIED)
-- This is the canonical version that was applied to the live DB.
-- Run order: extend enum FIRST in its own transaction, then everything else.
-- =====================================================================

-- ----- TX 1: extend memory_type enum -----
ALTER TYPE memory_type ADD VALUE IF NOT EXISTS 'belief';
ALTER TYPE memory_type ADD VALUE IF NOT EXISTS 'principle';
ALTER TYPE memory_type ADD VALUE IF NOT EXISTS 'reflection';
ALTER TYPE memory_type ADD VALUE IF NOT EXISTS 'journal';

-- ----- TX 2: schema additions -----
ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS life_area   TEXT,
  ADD COLUMN IF NOT EXISTS is_project  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entities    JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mood        TEXT,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_memories_life_area  ON memories(life_area);
CREATE INDEX IF NOT EXISTS idx_memories_is_project ON memories(is_project);
CREATE INDEX IF NOT EXISTS idx_memories_occurred   ON memories(occurred_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_memories_entities   ON memories USING GIN(entities);

-- Backfill: real projects (not 'personal'/'life') flip is_project=true
UPDATE memories m SET is_project = TRUE
WHERE project_id IN (
  SELECT id FROM projects WHERE slug NOT IN ('personal','life','life-areas')
)
AND is_project = FALSE;

-- New tables
CREATE TABLE IF NOT EXISTS entities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('person','place','organization','book','tool','concept','event','other')),
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entities_kind      ON entities(kind);
CREATE INDEX IF NOT EXISTS idx_entities_name_trgm ON entities USING GIN(name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS journals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL UNIQUE,
  win         TEXT,
  lesson      TEXT,
  followup    TEXT,
  mood        TEXT,
  energy      INT CHECK (energy BETWEEN 1 AND 10),
  raw_text    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_journals_date ON journals(date DESC);

CREATE TABLE IF NOT EXISTS questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt      TEXT NOT NULL,
  answer_ref  UUID REFERENCES memories(id) ON DELETE SET NULL,
  source      TEXT,
  helpful     BOOLEAN,
  asked_at    TIMESTAMPTZ DEFAULT NOW(),
  followed_up BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS interests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic      TEXT UNIQUE NOT NULL,
  weight     FLOAT DEFAULT 1.0,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen  TIMESTAMPTZ DEFAULT NOW(),
  memory_ids UUID[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS life_areas (
  slug       TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#a8a8b1',
  icon       TEXT,
  sort_order INT DEFAULT 0
);

INSERT INTO life_areas (slug, name, color, icon, sort_order) VALUES
  ('philosophy',    'Philosophy',    '#a8a8b1', 'Lightbulb',    1),
  ('faith',         'Faith',         '#a8a8b1', 'Sparkles',     2),
  ('health',        'Health',        '#a8a8b1', 'HeartPulse',   3),
  ('money',         'Money',         '#a8a8b1', 'Wallet',       4),
  ('relationships', 'Relationships', '#a8a8b1', 'Users',        5),
  ('career',        'Career',        '#a8a8b1', 'Briefcase',    6),
  ('learning',      'Learning',      '#a8a8b1', 'BookOpen',     7),
  ('hobby',         'Hobby',         '#a8a8b1', 'Palette',      8),
  ('family',        'Family',        '#a8a8b1', 'Home',         9),
  ('travel',        'Travel',        '#a8a8b1', 'Plane',       10),
  ('other',         'Other',         '#a8a8b1', 'Circle',      11)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE entities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE journals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE interests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_areas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY entities_anon_read    ON entities    FOR SELECT USING (true);
  CREATE POLICY entities_anon_insert  ON entities    FOR INSERT WITH CHECK (true);
  CREATE POLICY entities_anon_update  ON entities    FOR UPDATE USING (true);
  CREATE POLICY journals_anon_read    ON journals    FOR SELECT USING (true);
  CREATE POLICY journals_anon_insert  ON journals    FOR INSERT WITH CHECK (true);
  CREATE POLICY journals_anon_update  ON journals    FOR UPDATE USING (true);
  CREATE POLICY journals_anon_delete  ON journals    FOR DELETE USING (true);
  CREATE POLICY questions_anon_read   ON questions   FOR SELECT USING (true);
  CREATE POLICY questions_anon_insert ON questions   FOR INSERT WITH CHECK (true);
  CREATE POLICY questions_anon_update ON questions   FOR UPDATE USING (true);
  CREATE POLICY interests_anon_read   ON interests   FOR SELECT USING (true);
  CREATE POLICY interests_anon_insert ON interests   FOR INSERT WITH CHECK (true);
  CREATE POLICY life_areas_anon_read  ON life_areas  FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS journals_touch  ON journals;
CREATE TRIGGER journals_touch  BEFORE UPDATE ON journals  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS entities_touch  ON entities;
CREATE TRIGGER entities_touch  BEFORE UPDATE ON entities  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Verification (post-migration result on prod): 67 project / 4 life / 11 areas
-- SELECT
--   (SELECT COUNT(*) FROM memories WHERE is_project=TRUE)  AS project_memories,
--   (SELECT COUNT(*) FROM memories WHERE is_project=FALSE) AS life_memories,
--   (SELECT COUNT(*) FROM life_areas)                       AS life_area_count;
