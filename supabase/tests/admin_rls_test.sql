-- RLS-test voor de eigenaar-/adminmodus (supabase/migrations/admin_roles_audit.sql). Draait na de stub en de migratie.
-- Uitvoeren: scripts/test-admin-rls.sh. Elke controle raised een exception bij falen; psql stopt dan met een foutcode.
create schema t;
create function t.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function t.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';
end $$;
create function t.as_super() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
end $$;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'TEST MISLUKT: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
create function t.rows(q text) returns bigint language plpgsql as $$
declare n bigint; begin execute 'select count(*) from (' || q || ') q' into n; return n; end $$;
create function t.affected(q text) returns bigint language plpgsql as $$
declare n bigint; begin execute q; get diagnostics n = row_count; return n; end $$;
-- Verwacht een "insufficient_privilege" (42501: ontbrekend recht, RLS-schending of onze trigger).
create function t.denied(q text, msg text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when insufficient_privilege then
    raise notice 'ok - %', msg;
    return;
  end;
  raise exception 'TEST MISLUKT (had geweigerd moeten worden): %', msg;
end $$;
grant usage on schema t to public;
grant execute on all functions in schema t to public;

insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-00000000000f', 'nieuw@example.test', now());

do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a'; -- eigenaar
  b uuid := '00000000-0000-0000-0000-00000000000b'; -- wordt admin
  c uuid := '00000000-0000-0000-0000-00000000000c'; -- gewone gebruiker
  d uuid := '00000000-0000-0000-0000-00000000000d'; -- andere gewone gebruiker
  f uuid := '00000000-0000-0000-0000-00000000000f'; -- nog zonder profiel
  fp_c uuid; fp_d uuid; v1 uuid; n bigint; r jsonb;
begin
  -- ===== Rollen =====
  perform t.as_super();
  perform t.ok((select role from public.users where id = a) = 'owner', 'geverifieerd e-mailadres: eigenaar na de migratie');
  perform t.ok((select count(*) from public.users where role = 'owner') = 1, 'precies één eigenaar');
  perform t.ok((select role from public.users where id = '00000000-0000-0000-0000-00000000000e') = 'user', 'ongeverifieerd account blijft user');

  perform t.as_user(a);
  perform t.ok(t.affected(format($q$update public.users set role = 'admin' where id = %L$q$, b)) = 1, 'eigenaar kan een admin aanwijzen');
  perform t.denied(format($q$update public.users set role = 'user' where id = %L$q$, a), 'laatste eigenaar kan niet verlaagd worden');

  perform t.as_user(c);
  perform t.denied(format($q$update public.users set role = 'owner' where id = %L$q$, c), 'gebruiker kan eigen rol niet naar owner verhogen');
  perform t.denied(format($q$update public.users set role = 'admin' where id = %L$q$, c), 'gebruiker kan eigen rol niet naar admin verhogen');
  perform t.ok(t.affected(format($q$update public.users set first_name = 'Nieuw' where id = %L$q$, c)) = 1, 'gebruiker kan wel zijn eigen profiel bijwerken');
  perform t.ok(t.affected(format($q$update public.users set role = 'admin' where id = %L$q$, d)) = 0, 'gebruiker kan andermans rol niet wijzigen (0 rijen)');
  perform t.as_super();
  perform t.ok((select role from public.users where id = d) = 'user', 'andermans rol is ongewijzigd');

  perform t.as_user(f);
  perform t.denied(format($q$insert into public.users (id, role) values (%L, 'admin')$q$, f), 'nieuw profiel kan niet als admin worden aangemaakt');
  perform t.as_user(f);
  perform t.ok(t.affected(format($q$insert into public.users (id) values (%L)$q$, f)) = 1, 'nieuw profiel als gewone gebruiker mag wel');

  perform t.as_user(b);
  perform t.ok(t.affected(format($q$update public.users set role = 'owner' where id = %L$q$, c)) = 0, 'admin kan geen rollen wijzigen (alleen de eigenaar)');
  perform t.denied(format($q$update public.users set role = 'owner' where id = %L$q$, b), 'admin kan zichzelf geen eigenaar maken');
  perform t.as_super();
  perform t.ok((select role from public.users where id = c) = 'user' and (select role from public.users where id = b) = 'admin', 'rollen ongewijzigd na admin-poging');

  perform t.as_user(b);
  perform t.ok((select public.is_admin()), 'is_admin() waar voor admin');
  perform t.as_user(a); perform t.ok((select public.is_admin()), 'is_admin() waar voor eigenaar');
  perform t.as_user(c); perform t.ok(not (select public.is_admin()), 'is_admin() onwaar voor gebruiker');
  perform t.ok(not (select public.is_library_admin()), 'is_library_admin() onwaar voor gebruiker');
  perform t.as_user(b); perform t.ok((select public.is_library_admin()), 'is_library_admin() volgt de rol (admin)');
  perform t.as_anon(); perform t.ok(not (select public.is_admin()), 'is_admin() onwaar voor anoniem');

  -- ===== Activiteiten =====
  perform t.as_super();
  insert into public.activiteiten (id, titel, status, visibility, author_id) values
    ('pub', 'Openbare activiteit', 'approved', 'public', null),
    ('weg', 'Zacht verwijderd', 'approved', 'public', null),
    ('priv-c', 'Privé van C', 'draft', 'private', c),
    ('priv-d', 'Privé van D', 'draft', 'private', d);
  update public.activiteiten set deleted_at = now() where id = 'weg';
  perform t.ok((select count(*) from public.audit_log where entity_type = 'activiteit' and action = 'insert') = 4, 'insert van activiteiten wordt gelogd');

  perform t.as_anon();
  perform t.ok(t.rows('select 1 from public.activiteiten') = 2, 'anoniem ziet alleen openbare activiteiten');
  perform t.ok(t.affected($q$update public.activiteiten set titel = 'x'$q$) = 0, 'anoniem kan niets wijzigen');
  perform t.ok(t.affected($q$delete from public.activiteiten$q$) = 0, 'anoniem kan niets verwijderen');

  perform t.as_user(c);
  perform t.ok(t.rows('select 1 from public.activiteiten') = 3, 'gebruiker ziet openbaar + eigen privé');
  perform t.ok(t.affected($q$update public.activiteiten set titel = 'gehackt' where id in ('pub', 'priv-d')$q$) = 0, 'gebruiker kan andermans activiteit niet wijzigen');
  perform t.ok(t.affected($q$delete from public.activiteiten where id in ('pub', 'priv-d')$q$) = 0, 'gebruiker kan andermans activiteit niet verwijderen');
  perform t.ok(t.affected($q$update public.activiteiten set titel = 'Eigen titel' where id = 'priv-c'$q$) = 1, 'gebruiker kan eigen activiteit wijzigen');

  perform t.as_super();
  select changes into r from public.audit_log where entity_id = 'priv-c' and action = 'update' order by id desc limit 1;
  perform t.ok(r -> 'titel' ->> 'new' = 'Eigen titel' and r -> 'titel' ->> 'old' = 'Privé van C', 'auditlog bewaart veld, oud en nieuw');
  perform t.ok((select actor_id from public.audit_log where entity_id = 'priv-c' and action = 'update' order by id desc limit 1) = c
    and (select actor_role from public.audit_log where entity_id = 'priv-c' and action = 'update' order by id desc limit 1) = 'user', 'auditlog bewaart wie en welke rol');
  select count(*) into n from public.audit_log;
  update public.activiteiten set like_count = 5 where id = 'pub';
  perform t.ok((select count(*) from public.audit_log) = n, 'ruiswijzigingen (like_count) komen niet in het auditlog');

  perform t.as_user(b);
  perform t.ok(t.rows('select 1 from public.activiteiten') = 4, 'admin ziet alle activiteiten, ook privé en verwijderd');
  perform t.ok(t.affected($q$update public.activiteiten set status = 'approved', visibility = 'public' where id = 'priv-d'$q$) = 1, 'admin kan andermans activiteit publiceren');
  perform t.ok(t.affected($q$update public.activiteiten set deleted_at = now() where id = 'priv-d'$q$) = 1, 'admin kan zacht verwijderen');
  perform t.ok(t.affected($q$update public.activiteiten set deleted_at = null where id = 'priv-d'$q$) = 1, 'admin kan herstellen');
  perform t.as_super();
  perform t.ok((select actor_role from public.audit_log where entity_id = 'priv-d' and action = 'update' order by id desc limit 1) = 'admin', 'auditlog noteert admin als actor-rol');
  perform t.as_user(b);

  perform t.ok(t.rows('select 1 from public.audit_log') > 0, 'admin leest het auditlog');
  perform t.denied($q$insert into public.audit_log (entity_type, entity_id, action) values ('activiteit', 'x', 'update')$q$, 'admin kan het auditlog niet rechtstreeks beschrijven');
  perform t.denied($q$delete from public.audit_log$q$, 'admin kan het auditlog niet wissen');
  perform t.denied($q$update public.audit_log set changes = '{}'$q$, 'admin kan het auditlog niet aanpassen');
  perform t.as_user(c);
  perform t.ok(t.rows('select 1 from public.audit_log') = 0, 'gewone gebruiker ziet het auditlog niet');
  perform t.denied($q$insert into public.audit_log (entity_type, entity_id, action) values ('activiteit', 'x', 'update')$q$, 'gebruiker kan het auditlog niet beschrijven');
  perform t.as_anon();
  perform t.denied($q$select 1 from public.audit_log$q$, 'anoniem heeft geen toegang tot het auditlog');

  perform t.as_user(b);
  perform t.ok(t.affected($q$delete from public.activiteiten where id = 'weg'$q$) = 1, 'admin kan definitief verwijderen');
  perform t.as_super();
  perform t.ok((select count(*) from public.audit_log where entity_id = 'weg' and action = 'delete') = 1, 'definitieve verwijdering wordt gelogd (met de volledige rij)');

  -- ===== Plattegronden =====
  insert into public.floorplans_3d (user_id, naam, data) values (c, 'Plattegrond C', '{"version":1,"items":[],"coneFields":[]}') returning id into fp_c;
  insert into public.floorplans_3d (user_id, naam, data) values (d, 'Plattegrond D', '{"version":1,"items":[],"coneFields":[]}') returning id into fp_d;

  perform t.as_anon();
  perform t.ok(t.rows('select 1 from public.floorplans_3d') = 0, 'anoniem ziet geen plattegronden');
  perform t.as_user(c);
  perform t.ok(t.rows('select 1 from public.floorplans_3d') = 1, 'gebruiker ziet alleen eigen plattegrond');
  perform t.ok(t.affected(format($q$update public.floorplans_3d set naam = 'x' where id = %L$q$, fp_d)) = 0, 'gebruiker kan andermans plattegrond niet wijzigen');
  perform t.ok(t.affected(format($q$delete from public.floorplans_3d where id = %L$q$, fp_d)) = 0, 'gebruiker kan andermans plattegrond niet verwijderen');

  perform t.as_user(b);
  perform t.ok(t.rows('select 1 from public.floorplans_3d') = 2, 'admin ziet alle plattegronden');
  perform t.ok(t.affected(format($q$update public.floorplans_3d set data = '{"version":1,"items":[{"id":"i","slug":"s"}],"coneFields":[]}' where id = %L$q$, fp_c)) = 1, 'admin kan andermans plattegrond opslaan');
  perform t.ok(t.rows(format('select 1 from public.floorplan_versions where floorplan_id = %L', fp_c)) = 1, 'oude staat is als versie bewaard');
  perform t.ok(t.affected(format($q$update public.floorplans_3d set data = '{"version":1,"items":[{"id":"i","slug":"s"},{"id":"j","slug":"s"}],"coneFields":[]}' where id = %L$q$, fp_c)) = 1, 'tweede opslag direct erna');
  perform t.ok(t.rows(format('select 1 from public.floorplan_versions where floorplan_id = %L', fp_c)) = 1, 'versies worden gedund (max 1 per 10 minuten per persoon)');

  perform t.as_user(c);
  perform t.ok(t.affected(format($q$update public.floorplans_3d set naam = 'Nieuwe naam' where id = %L$q$, fp_c)) = 1, 'eigenaar kan eigen plattegrond opslaan');
  perform t.ok(t.rows(format('select 1 from public.floorplan_versions where floorplan_id = %L', fp_c)) = 2, 'andere persoon: nieuwe versie');
  perform t.as_user(d);
  perform t.ok(t.rows(format('select 1 from public.floorplan_versions where floorplan_id = %L', fp_c)) = 0, 'andere gebruiker ziet de versies niet');
  perform t.as_anon();
  perform t.denied($q$select 1 from public.floorplan_versions$q$, 'anoniem heeft geen toegang tot versies');

  -- terugzetten
  perform t.as_super();
  select id into v1 from public.floorplan_versions where floorplan_id = fp_c order by version asc limit 1;
  perform t.as_user(c);
  perform t.denied(format($q$select public.restore_floorplan_version(%L)$q$, v1), 'gewone gebruiker kan geen versie terugzetten');
  perform t.as_anon();
  perform t.denied(format($q$select public.restore_floorplan_version(%L)$q$, v1), 'anoniem kan geen versie terugzetten');
  perform t.as_user(b);
  perform t.ok(t.rows(format('select 1 from public.floorplan_versions where floorplan_id = %L', fp_c)) = 2, 'admin ziet de versies');
  perform public.restore_floorplan_version(v1);
  perform t.as_super();
  perform t.ok((select jsonb_array_length(data -> 'items') from public.floorplans_3d where id = fp_c) = 0, 'terugzetten herstelt de oude scene');
  perform t.ok((select count(*) from public.floorplan_versions where floorplan_id = fp_c) = 3, 'terugzetten bewaart de huidige staat eerst als versie');

  -- maximaal 10 versies
  perform set_config('gymwiki.force_version', '1', true);
  for i in 1..14 loop
    update public.floorplans_3d set naam = 'run ' || i where id = fp_d;
  end loop;
  perform set_config('gymwiki.force_version', '', true);
  perform t.ok((select count(*) from public.floorplan_versions where floorplan_id = fp_d) = 10, 'alleen de laatste 10 versies blijven bewaard');
  perform t.ok((select min(version) from public.floorplan_versions where floorplan_id = fp_d) = 5, 'oudste versies zijn opgeruimd');

  perform t.ok((select changes -> 'data' -> 'new' ->> 'items' from public.audit_log where entity_type = 'plattegrond' and entity_id = fp_c::text and changes ? 'data' order by id asc limit 1) = '1', 'auditlog plattegrond bevat een samenvatting (geen volledige scene)');

  -- ===== Plattegrond van een beheerder bij een bibliotheekactiviteit =====
  perform t.as_super();
  insert into public.floorplans_3d (user_id, naam, activiteit_id, data) values (b, 'Beheerplattegrond', 'pub', '{"version":1,"items":[],"coneFields":[]}');
  insert into public.floorplans_3d (user_id, naam, activiteit_id, data) values (d, 'Plattegrond van D bij openbare activiteit', 'pub', '{"version":1,"items":[],"coneFields":[]}');
  perform t.as_user(c);
  perform t.ok(t.rows($q$select 1 from public.floorplans_3d where naam = 'Beheerplattegrond'$q$) = 1, 'bekijker ziet de plattegrond die een beheerder bij een openbare activiteit maakte');
  perform t.ok(t.rows($q$select 1 from public.floorplans_3d where naam like 'Plattegrond van D%'$q$) = 0, 'bekijker ziet een plattegrond van een willekeurige gebruiker bij andermans activiteit niet');
  perform t.ok((select array_agg(x order by x) from public.curator_ids() x) = array[a, b], 'curator_ids() geeft alleen eigenaar en admin');
  perform t.ok(public.is_curator(b) and not public.is_curator(c), 'is_curator() volgt de rol');
  perform t.as_anon();
  perform t.ok(t.rows('select 1 from public.floorplans_3d') = 0, 'anoniem ziet ook de beheerplattegrond niet via RLS');

  -- ===== Storage =====
  perform t.as_user(b);
  perform t.ok(t.affected(format($q$insert into storage.objects (bucket_id, name) values ('floorplan-previews', %L)$q$, d::text || '/x.jpg')) = 1, 'admin kan een preview in andermans map schrijven');
  perform t.as_user(c);
  perform t.denied(format($q$insert into storage.objects (bucket_id, name) values ('floorplan-previews', %L)$q$, d::text || '/y.jpg'), 'gebruiker kan niet in andermans map schrijven');
  perform t.ok(t.affected(format($q$insert into storage.objects (bucket_id, name) values ('floorplan-previews', %L)$q$, c::text || '/z.jpg')) = 1, 'gebruiker kan in de eigen map schrijven');
  perform t.as_super();
  raise notice 'ALLE RLS-TESTS GESLAAGD';
end $$;
