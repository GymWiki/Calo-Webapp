-- Adds `learning_outcomes` to public.lessons: a genummerde lijst met
-- leeruitkomsten, getoond in de nieuwe "Lesdoel & Beginsituatie" sectie
-- bovenaan de lesdetailpagina (naast het bestaande `goals`/"Doelen" veld).
--
-- Deviation from the brief, documented here: the brief only describes how
-- this field is *displayed* ("VOORWAARDELIJK: alleen tonen als de array
-- niet leeg is") — it doesn't ask for a form field to populate it, so this
-- migration adds the column without wiring up any create/edit UI. The
-- column is nullable and defaults to null, so every existing/new lesson
-- simply hides the section until a future round adds a way to fill it in.
alter table public.lessons
  add column if not exists learning_outcomes text[];
