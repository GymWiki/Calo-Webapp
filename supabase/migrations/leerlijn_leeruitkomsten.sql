-- Centrale, beheerbare structuur met concrete, selecteerbare leeruitkomsten
-- per leerlijn — vervangt het vrije-tekstveld dat de AI Activiteiten
-- Generator voorheen zelf liet invullen (en meestal leeg liet, zie de
-- brief/het screenshot). Een gebruiker kiest nu vooraf één of meer van deze
-- concrete deelvaardigheden, die zowel de generatie-prompt sturen als
-- (deterministisch, niet AI-geraden) direct de "Leeruitkomsten"-sectie van
-- de gegenereerde activiteit vullen.
--
-- `leerlijn` is text (geen foreign key): activiteiten.leerlijn/`lib/
-- constants/learningLines.ts`'s LEARNING_LINE_CATEGORIES kennen geen apart
-- leerlijnen-tabel met id's — dezelfde tekstwaarden worden hier als sleutel
-- herbruikt.
--
-- "Zonder codewijziging uitbreidbaar": nieuwe leeruitkomsten toevoegen is
-- een simpele INSERT in deze tabel (bijv. via de Supabase Table Editor of
-- een korte migratie), geen aanpassing aan de applicatiecode.

create table public.leerlijn_leeruitkomsten (
  id uuid primary key default gen_random_uuid(),
  leerlijn text not null,
  leeruitkomst text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (leerlijn, leeruitkomst)
);

create index idx_leerlijn_leeruitkomsten_leerlijn on public.leerlijn_leeruitkomsten (leerlijn, sort_order);

alter table public.leerlijn_leeruitkomsten enable row level security;
alter table public.leerlijn_leeruitkomsten force row level security;

-- Iedereen (ingelogd) leest de volledige catalogus — nodig om de
-- leeruitkomst-chips te tonen in de generator-flow. Beheer (nieuwe/gewijzigde
-- leeruitkomsten) is voorbehouden aan de bibliotheek-beheerder, zelfde
-- is_library_admin()-gate als knowledge_packages.sql.
create policy "leerlijn_leeruitkomsten_select" on public.leerlijn_leeruitkomsten
  for select
  to authenticated
  using (true);

create policy "leerlijn_leeruitkomsten_write_admin" on public.leerlijn_leeruitkomsten
  for all
  to authenticated
  using (public.is_library_admin())
  with check (public.is_library_admin());

-- ============================================================================
-- Seed: 3-4 concrete deelvaardigheden per leerlijn (alle 22 leerlijnen uit
-- LEARNING_LINE_CATEGORIES). Idempotent via de (leerlijn, leeruitkomst)-
-- unique-constraint hierboven.
-- ============================================================================
insert into public.leerlijn_leeruitkomsten (leerlijn, leeruitkomst, sort_order) values
  -- Atletiek
  ('Lopen', 'Zo snel mogelijk een vaste afstand afleggen', 1),
  ('Lopen', 'Op tijd starten na een startsignaal', 2),
  ('Lopen', 'Tempo verdelen over een langere afstand', 3),
  ('Lopen', 'Het stokje soepel overdragen tijdens een estafette', 4),

  ('Hoog- en verspringen', 'Met een aanloop optimale afzet krijgen', 1),
  ('Hoog- en verspringen', 'Zo hoog mogelijk over een lat springen zonder aan te raken', 2),
  ('Hoog- en verspringen', 'Zo ver mogelijk springen vanuit stand of aanloop', 3),
  ('Hoog- en verspringen', 'Veilig neerkomen in de zandbak of op de mat', 4),

  ('Werpen', 'Een voorwerp zo ver mogelijk wegwerpen met de juiste werptechniek', 1),
  ('Werpen', 'Een voorwerp nauwkeurig op een doel richten', 2),
  ('Werpen', 'Kracht opbouwen vanuit de benen en heup tijdens het werpen', 3),

  -- Bewegen op muziek
  ('stappen/lopen', 'Op de maat van de muziek lopen of stappen', 1),
  ('stappen/lopen', 'Een vaste stappenreeks onthouden en herhalen', 2),
  ('stappen/lopen', 'Samen met een groep in de pas blijven', 3),

  ('Motieven', 'Een kort bewegingsmotief nabewegen', 1),
  ('Motieven', 'Een eigen bewegingsmotief bedenken en tonen', 2),
  ('Motieven', 'Bewegingen laten aansluiten op het karakter van de muziek', 3),

  -- Klimmen
  ('Klauteren', 'Over, onder en door hindernissen klauteren', 1),
  ('Klauteren', 'Op een veilige manier ergens naar boven klauteren', 2),
  ('Klauteren', 'Het eigen lichaamsgewicht dragen tijdens klauteren', 3),

  ('Touwklimmen', 'Met handen en voeten omhoog klimmen langs een touw', 1),
  ('Touwklimmen', 'Gecontroleerd weer naar beneden klimmen of glijden', 2),
  ('Touwklimmen', 'Voldoende grip houden tijdens het klimmen', 3),

  -- Spel
  ('Honkloopspelen', 'Iemand insluiten tussen de honken', 1),
  ('Honkloopspelen', 'De bal op de juiste plek in het veld slaan', 2),
  ('Honkloopspelen', 'Op tijd naar het volgende honk rennen', 3),
  ('Honkloopspelen', 'Samenwerken om de bal snel terug te spelen', 4),

  ('Jongleren', 'Twee of meer voorwerpen tegelijk in de lucht houden', 1),
  ('Jongleren', 'Een voorwerp opvangen na een worp', 2),
  ('Jongleren', 'Het eigen ritme bewaren tijdens het jongleren', 3),

  ('Mikken', 'Een voorwerp nauwkeurig op een doel of mikpunt richten', 1),
  ('Mikken', 'De juiste kracht gebruiken om een doel te bereiken', 2),
  ('Mikken', 'Reageren op de afstand tot het doel', 3),

  ('Over en weer inplaatsen', 'De bal overspelen naar een medespeler op de juiste plek', 1),
  ('Over en weer inplaatsen', 'Vrijlopen om de bal te kunnen ontvangen', 2),
  ('Over en weer inplaatsen', 'Een opening in het veld herkennen en benutten', 3),

  ('Passeren en onderscheppen', 'Een tegenstander passeren met de bal', 1),
  ('Passeren en onderscheppen', 'De bal onderscheppen van de tegenstander', 2),
  ('Passeren en onderscheppen', 'Ruimte creëren om te kunnen passeren', 3),

  ('Tikspelen', 'Op tijd wegkomen om niet getikt te worden', 1),
  ('Tikspelen', 'Iemand tikken door hem of haar in te halen', 2),
  ('Tikspelen', 'Een veilige plek (vrijplaats) herkennen en benutten', 3),

  -- Turnen
  ('Balanceren', 'Het evenwicht bewaren op een smal of instabiel oppervlak', 1),
  ('Balanceren', 'Een balansoefening rustig en gecontroleerd uitvoeren', 2),
  ('Balanceren', 'Herstellen na een (bijna) evenwichtsverlies', 3),

  ('Springen', 'Met een goede afzet en landing over of van een toestel springen', 1),
  ('Springen', 'Een sprong met draai of vorm uitvoeren', 2),
  ('Springen', 'Veilig en gecontroleerd neerkomen na een sprong', 3),

  ('Zwaaien', 'Met het lichaam een zwaaibeweging opbouwen (bijv. aan ringen of rekstok)', 1),
  ('Zwaaien', 'Vaart/amplitude opbouwen tijdens het zwaaien', 2),
  ('Zwaaien', 'Gecontroleerd afspringen vanuit een zwaai', 3),

  -- Zelfverdediging
  ('Stoeispelen', 'Een tegenstander uit balans brengen', 1),
  ('Stoeispelen', 'Het eigen evenwicht bewaren tijdens duwen of trekken', 2),
  ('Stoeispelen', 'Op een veilige, respectvolle manier lichaamscontact maken', 3),

  ('Trefspelen', 'Een tegenstander raken zonder zelf geraakt te worden', 1),
  ('Trefspelen', 'Ontwijken of ontsnappen aan een tikpoging', 2),
  ('Trefspelen', 'Snel reageren op een aanval', 3),

  -- Zwemmen
  ('Jezelf en de ander redden', 'Iemand in het water op een veilige manier benaderen en vasthouden', 1),
  ('Jezelf en de ander redden', 'Zelf drijvend blijven zonder hulpmiddel', 2),
  ('Jezelf en de ander redden', 'Om hulp roepen en overleven in het water', 3),

  ('Onder water gaan en verplaatsen', 'Rustig ademhalen en de adem inhouden onder water', 1),
  ('Onder water gaan en verplaatsen', 'Onder water een korte afstand afleggen', 2),
  ('Onder water gaan en verplaatsen', 'De ogen open houden en oriënteren onder water', 3),

  ('Springend te water gaan', 'Vanaf de kant of duikplank op een veilige manier het water in springen', 1),
  ('Springend te water gaan', 'Een sprong met controle over de lichaamshouding uitvoeren', 2),

  ('Verplaatsen', 'Een zwemslag efficiënt uitvoeren over een afstand', 1),
  ('Verplaatsen', 'Op de juiste manier ademhalen tijdens het zwemmen', 2),
  ('Verplaatsen', 'Tempo vasthouden over een langere afstand', 3),

  ('Aangepaste sportspelen', 'Een spelvorm in het water spelen met aangepaste regels', 1),
  ('Aangepaste sportspelen', 'Samen met anderen een opdracht in het water uitvoeren', 2),

  -- Overig
  ('Kennismaken', 'Namen en eigenschappen van klasgenoten leren via een spelvorm', 1),
  ('Kennismaken', 'Op een positieve manier contact maken met een nieuwe partner of groep', 2),

  ('Samenwerken', 'Samen met een groep een gezamenlijke opdracht uitvoeren', 1),
  ('Samenwerken', 'Taken verdelen binnen een groep', 2),
  ('Samenwerken', 'Elkaar helpen en aanmoedigen tijdens een activiteit', 3)
on conflict (leerlijn, leeruitkomst) do nothing;
