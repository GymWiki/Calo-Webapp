-- lesson_didactics already exists (created in schema_activities.sql) with a
-- fixed set of "lukt_het_zwak_see/do" style columns modelling the old 4-L
-- version of the didactische analyse. The new Walinga & Koekoek (2021)
-- model uses 3 L's, each with an arbitrary number of observation/action
-- entries, so the fixed-column shape no longer fits — replace it with a
-- single `items` JSONB array. The table is currently empty in production,
-- so this is a straight structural swap rather than a data migration.
--
-- Structure of an item within the `items` JSONB array:
-- [
--   {
--     "id": "uuid-1234",
--     "category": "loopt_het", -- 'loopt_het' | 'lukt_het' | 'leeft_het'
--     "sub_theme": "Werkvorm", -- optional, from the Walinga & Koekoek matrix
--     "observation": "Leerlingen snappen de wisselafspraak bij het matje niet",
--     "action": "Wisselstop invoeren en visueel voordoen met 2 leerlingen"
--   }
-- ]

alter table public.lesson_didactics
  drop column if exists instructions_text,
  drop column if exists lukt_het_zwak_see,
  drop column if exists lukt_het_zwak_do,
  drop column if exists loopt_het_see,
  drop column if exists loopt_het_do,
  drop column if exists leeft_het_see,
  drop column if exists leeft_het_do,
  drop column if exists lukt_het_goed_see,
  drop column if exists lukt_het_goed_do;

alter table public.lesson_didactics
  add column if not exists items jsonb not null default '[]'::jsonb;

-- lesson_didactics.lesson_id already carries a UNIQUE + FK ON DELETE CASCADE
-- constraint from its original creation (schema_activities.sql), matching
-- the "one didactics row per lesson" shape the brief's CREATE TABLE
-- statement describes — no change needed there.

-- The `lessons` table already has free-text `learning_line` and
-- `movement_problem` columns; the Basisdocument dropdowns in the UI now
-- populate those same columns with standardized values (with an "Anders,
-- namelijk..." free-text fallback) instead of introducing parallel
-- `basisdocument_*` columns that would just duplicate their meaning.
