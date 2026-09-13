-- learning_outcomes (jsonb op activiteiten) werd voor 59 rijen gevuld als
-- EEN array-element dat de hele, met newlines genummerde/gebulletpointte
-- tekst bevatte (bijv. ["Positie innemen...\n2. De shuttle slaan...\n3. Het
-- raken..."]), i.p.v. een array met drie losse elementen — zichtbaar op de
-- activiteit-detailpagina als één doorlopende alinea in plaats van drie
-- nette genummerde regels. De kolom is dus al correct getypeerd als array
-- — dit is een datakwaliteitsprobleem uit een eerdere handmatige invoer
-- (waarschijnlijk via de Supabase-tabeleditor), niet een schemaprobleem.
-- Geen enkele actieve invoerroute (wizard, upload, AI-generator) vult dit
-- veld op dit moment — het is uitsluitend aanwezig in de oorspronkelijk
-- geïmporteerde GymWiki-bibliotheek. Geverifieerd vóór toepassing: 59
-- rijen met exact 1 array-element dat een newline bevat, 0 rijen met al
-- meerdere elementen (dus geen risico op per ongeluk goede data kapot te
-- maken), en na afloop precies 59 rijen met >1 element en 0 met exact 1.
with source as (
  select id, learning_outcomes->>0 as raw
  from public.activiteiten
  where jsonb_array_length(learning_outcomes) = 1
    and (learning_outcomes->>0) ~ E'\n'
),
split as (
  select
    s.id,
    ord,
    trim(regexp_replace(trim(part), '^(?:[0-9]+[.)]\s*|[-•]\s*)', '')) as item
  from source s,
       unnest(regexp_split_to_array(s.raw, E'\n+')) with ordinality as u(part, ord)
),
aggregated as (
  select id, jsonb_agg(item order by ord) as new_outcomes
  from split
  where item <> '' and item <> ':'
  group by id
)
update public.activiteiten a
set learning_outcomes = agg.new_outcomes
from aggregated agg
where a.id = agg.id;
