-- Account verwijderen (Apple 5.1.1(v), Google Play account deletion).
-- Idempotent; NIET automatisch uitgevoerd (zie docs/release/checklist.md).
--
-- Beleid: bij verwijderen van een account verdwijnen profiel, abonnementsrij,
-- planning, favorieten enz. (ON DELETE CASCADE vanaf public.users). Goedgekeurde
-- bijdragen aan de gedeelde bibliotheek blijven bestaan maar worden anoniem
-- (author_id = null), net als de geïmporteerde basisactiviteiten. Niet-goedgekeurde
-- bijdragen (concept/afgewezen) worden door de server-actie verwijderd.

do $$
declare
  fk record;
begin
  -- activiteiten.author_id: cascade → set null (alleen als het nu cascade is).
  for fk in
    select c.conname
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.conrelid = 'public.activiteiten'::regclass
       and c.contype = 'f'
       and a.attname = 'author_id'
       and c.confdeltype <> 'n'
  loop
    execute format('alter table public.activiteiten drop constraint %I', fk.conname);
    alter table public.activiteiten
      add constraint activiteiten_author_id_fkey
      foreign key (author_id) references public.users (id) on delete set null;
  end loop;

  -- activiteiten.beoordeeld_door (beheerder) mag een verwijdering nooit blokkeren.
  for fk in
    select c.conname
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.conrelid = 'public.activiteiten'::regclass
       and c.contype = 'f'
       and a.attname = 'beoordeeld_door'
       and c.confdeltype <> 'n'
  loop
    execute format('alter table public.activiteiten drop constraint %I', fk.conname);
    alter table public.activiteiten
      add constraint activiteiten_beoordeeld_door_fkey
      foreign key (beoordeeld_door) references public.users (id) on delete set null;
  end loop;
end;
$$;

-- Controle vooraf (alleen lezen): welke foreign keys naar public.users blokkeren
-- een verwijdering nog (NO ACTION/RESTRICT)? Verwacht: geen rijen.
--   select conrelid::regclass as tabel, conname
--     from pg_constraint
--    where confrelid = 'public.users'::regclass and contype = 'f' and confdeltype in ('a', 'r');
