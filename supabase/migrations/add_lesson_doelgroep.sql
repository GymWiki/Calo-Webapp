-- Adds the same 1-6 doelgroep codes used by `activiteiten` (see
-- DOELGROEP_WAARDEN/DOELGROEP_LABELS in types/activity.ts) to `lessons`, so
-- the merged bibliotheekpagina (/zoeken) can apply its categorie/leerlijn/
-- doelgroep/materiaal filters uniformly across both GymWiki-activiteiten and
-- publiek gedeelde lessen. `group_name` on lessons stays freeform text (e.g.
-- "Groep 7/8" or "Klas 1B") and has no reliable mapping onto these numeric
-- codes, so lesmakers pick them explicitly in the lesbouwer instead.
alter table public.lessons
  add column if not exists doelgroep integer[] not null default '{}';
