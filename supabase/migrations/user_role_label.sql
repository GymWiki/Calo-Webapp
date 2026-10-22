-- Vervangt de vaste "Niet beschikbaar voor stage"-badge op het profiel door
-- een vrij invulbaar rol/functie-veld (bijv. "Student CALO Zwolle",
-- "Docent bewegingsonderwijs bij Zuyderzee Lyceum, Emmeloord"). Optioneel,
-- dus nullable — leeg is een geldige keuze en toont geen badge in de UI.
-- available_for_internship blijft ongewijzigd (nog steeds in gebruik via
-- de toggle op /profiel/instellingen), zie de toelichting in actions/profile.ts.
alter table public.users
  add column if not exists role_label text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_role_label_length_check') then
    alter table public.users
      add constraint users_role_label_length_check check (char_length(role_label) <= 60);
  end if;
end;
$$;

-- Geen nieuwe RLS-policy nodig: de bestaande "users_update_own" (rij-niveau,
-- auth.uid() = id) dekt dit al, zelfde patroon als available_for_internship/
-- holiday_region (zie actions/profile.ts) — geen kolomgrant-restrictie op
-- public.users elders in de codebase, dus niets aan te passen.
