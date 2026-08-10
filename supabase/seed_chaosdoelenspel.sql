-- ============================================================================
-- Seed: "Chaosdoelenspel" — complete voorbeeldles voor de testfase
-- ============================================================================
-- Optioneel: run dit in de SQL-editor nadat er minstens één account is
-- geregistreerd. Kiest de eerst geregistreerde gebruiker als auteur, zet de
-- les op `is_public = true` (zichtbaar in de 'Gouden Les' bibliotheek voor
-- alle gebruikers), en slaat de insert idempotent over als de les al bestaat.
-- ============================================================================

do $$
declare
  v_author_id uuid;
  v_lesson_id uuid;
begin
  if exists (select 1 from public.lessons where title = 'Chaosdoelenspel') then
    raise notice 'Chaosdoelenspel bestaat al, seed overgeslagen.';
    return;
  end if;

  select id into v_author_id from auth.users order by created_at asc limit 1;

  if v_author_id is null then
    raise notice 'Geen gebruikers gevonden — registreer eerst een account en run deze seed opnieuw.';
    return;
  end if;

  insert into public.lessons (
    author_id, title, group_name, learning_line, movement_problem, movement_theme,
    goals, points_of_attention, rules, min_participants, participants_bench,
    base_materials, rule_materials, is_public
  ) values (
    v_author_id,
    'Chaosdoelenspel',
    'Groep 7/8',
    'Doelspelen',
    'Overzicht houden en kiezen tussen aanvallen en verdedigen in wisselende spelsituaties',
    'Doelen maken en verdedigen in chaos',
    'Motorisch: leerlingen kunnen doelpogingen op meerdere doelen afwisselen. Sociaal: leerlingen spelen samen zonder ruzie over de telling.',
    'Let op overbelasting bij het duiken/keepen; wissel keepers regelmatig.',
    array[
      'Elk doelpunt telt 1 punt',
      'Niet hard op de keeper schieten',
      'Iedere 2 minuten wisselen van rol'
    ],
    8,
    2,
    array['8 kleine doeltjes', '4 ballen', 'hesjes in 2 kleuren'],
    array['4 pionnen voor het middengebied'],
    true
  )
  returning id into v_lesson_id;

  insert into public.lesson_didactics (
    lesson_id, instructions_text,
    lukt_het_zwak_see, lukt_het_zwak_do,
    loopt_het_see, loopt_het_do,
    leeft_het_see, leeft_het_do,
    lukt_het_goed_see, lukt_het_goed_do
  ) values (
    v_lesson_id,
    'Plaatje: doeltjes verspreid over het veld tekenen op het bord. Praatje: leg de puntentelling kort uit. Wisselafspraken: fluitsignaal = wisselen van doel.',
    'Speler mist het doel of durft niet te schieten.',
    'Laat de zwakkere speler dichterbij een groter doel starten.',
    'Te veel spelers rond één doel.',
    'Verdeel de klas in kleinere groepjes per doel-cluster.',
    'Leerlingen juichen en rennen enthousiast tussen doelen.',
    'Beloon variatie: extra punt voor scoren op een doel dat nog niemand heeft gebruikt.',
    'Speler combineert fake en schot moeiteloos.',
    'Geef deze speler een extra regel: alleen met de zwakke voet scoren.'
  );

  insert into public.lesson_blocks (lesson_id, block_type, content) values
    (v_lesson_id, 'arrangement', 'Speelveld van ongeveer 20x20m met 8 kleine doeltjes verspreid over het veld, in twee kleurgroepen (4 rood, 4 blauw).'),
    (v_lesson_id, 'deelnemers_regels', 'Twee teams van elk 4-6 spelers. Iedereen valt de doeltjes van de andere kleur aan en verdedigt de eigen kleur. Wisselspelers op de bank wisselen elke 2 minuten in.'),
    (v_lesson_id, 'plaatje_praatje', 'Toon op het bord waar de doeltjes staan en welke kleur bij welk team hoort. Leg kort de puntentelling uit voordat het spel begint.'),
    (v_lesson_id, 'aandachtspunten', 'Let op te hard schieten van dichtbij en op overbelasting van leerlingen die als keeper spelen.');

  raise notice 'Chaosdoelenspel aangemaakt met lesson_id %', v_lesson_id;
end $$;
