# Nieuwe assets (inventarisatie, 5 november 2026)

Status: **inventarisatie klaar, verwerking nog niet gestart** — zie "Open vragen". Er is niets naar productie geschreven of geüpload.

## Hoe is vergeleken
- Bron: Drive-map `3D_Models` (connector). Vergeleken op bestandsnaam, bestandsgrootte en wijzigingstijd, en voor de nieuwe objecten op een inhoudshash (md5 van de gedownloade GLB's).
- Basislijn leerlingen: `lib/students/poses.json` (43 poses, laatste verwerking 31 okt 22:27 UTC). Basislijn objecten: de laatste volledige Drive-sync (22 okt) plus de catalogus-snapshot van deze sessie (184 modellen). **De live catalogus (Supabase) kon in deze sessie niet worden gelezen** (de Supabase-connector vraagt eerst een inlogstap), dus "nieuw" voor objecten is bepaald tegen die snapshot.

## Leerlingposes: geen nieuwe
In `Leerlingen` is sinds de verwerking van 31 okt **niets meer toegevoegd of gewijzigd** (laatste wijziging 31 okt 16:59 UTC; 93 basisbestanden + 5 kleurvarianten per pose).
- 43 poses zijn geregistreerd; alle 43 bestaan nog in Drive.
- 49 andere bestandsnamen zijn dubbel van een geregistreerde pose (zelfde grootte, en voor de gedownloade bestanden bevestigd met een hash): `football`/`rugby`/`american_football_sprint` = `american_football`, `quarterback`/`football_passen`/`rugby_passen` = `american_football_passen`, `judoka*`/`judo_*wit_pak` = `judo*`, `bal_trappen` = `voetbal`, `bank_zitten` = `zittend`, `squat` = `landen`, `pingpong` = `tafeltennis`, enz.
- **Eén twijfelgeval, niet opgenomen:** `leerling_basketbal_klaarstand.glb` (1.048.780 B, 29 okt) — unieke grootte, niet geregistreerd, niet in `docs/students.md`. Waarschijnlijk een pose die ooit is overgeslagen. Zeg het als hij erbij mag.
- Kleurvarianten (`_blauw`, `_geel`, `_groen`, `_paars`, `_rood`): niet nodig, de kleur kiest de gebruiker in de editor.

## Objecten
### Nieuw: map `Multiblock_Gymblok` (25 GLB's, aangemaakt 4 nov 16:28–16:38)
De 25 bestanden bevatten maar **2 unieke geometrieën** (hashes):

| Familie | Bestandsnamen (zelfde inhoud) | Gemeten (m, x/hoogte/z) | Voorstel |
| --- | --- | --- | --- |
| Foamblok / turnblok | `turnblok`, `foamblok`, `gymblok`, `multiblock` (identiek) + `_120x90x60` | 1,226 × 0,623 × 0,900 | Eén item, 3 maten als variant |
| idem | `*_120x90x45` | 1,226 × 0,473 × 0,900 | variant (lager) |
| idem | `*_90x60x45` | 0,926 × 0,471 × 0,600 | variant (klein) |
| Foambalk | `turnbalk_foam`, `foambalk`, `multibar`, `scheidingsbalk`, `zaalverdeler` (+ `_300x30x30` van elk, zelfde grootte) | 3,000 × 0,440 × 0,300 | Eén item |

Vragen: (1) onder welke naam wil je de blokken en de balk in de bibliotheek ("Turnblok foam"? "Zaalverdeler"?), omdat dezelfde geometrie vijf namen heeft; (2) de balk meet 0,44 m hoog terwijl `300x30x30` een hoogte van 0,30 m suggereert (klittenband/logo's steken uit?) — wil je dat de botsingsvorm 0,30 of 0,44 is? Categorie-voorstel: Toestellen › Foam / Klein materiaal; sporten: turnen, bewegingsonderwijs; stapelbaar (blokken ja, balk nee).

### Mogelijk nieuw (niet te bevestigen zonder de live catalogus)
Staan in Drive maar niet in mijn snapshot; ze zijn waarschijnlijk al eerder verwerkt als veldopstelling of omgeving (volleybal/badminton/gymzaal/atletiekbaan/sportveld/judomatten, 52 bestanden): `judomat_200x100x4`, `judomat_vloer_halve_zaal`, `judomatten_halve_zaal`, `judomat_los_200x100x4_groen|rood`, `judomatten_halve_gymzaal_10x10m|10x12m(_groen|_blauw_rood)`, `gymzaal_standaard|complex_2x2|complex_4x1`, `sportveld_multifunctioneel|school_combiveld`, `atletiekbaan_compleet|school_sprint_verspringen`, de volleybal- en badminton-opstellingen en -netten, `basketbalbord_los`, de honkbalhonken. Ik raad aan ze niet zonder jouw bevestiging opnieuw te verwerken.

### Mogelijk bijgewerkt
Op 29 okt 20:09 UTC zijn **239 bestaande bestanden tegelijk opnieuw opgeslagen** (grootte 1–3 % afwijkend t.o.v. de sync van 22 okt, bv. `turnkast_*`, `minitrampoline`, `springplank_senior_4veers`, `veldhockeystick` 50.348 → 63.092 B). Dat lijkt een bulk-export en niet een inhoudelijke aanpassing, maar zonder hashes van de eerder verwerkte bronnen is dat niet te bewijzen. Ik heb ze **niet** overschreven. Wil je dat ik ze vergelijk (afmetingen/geometrie van de huidige modellen tegen Drive), dan kost dat een download per bestand.

## Overgeslagen (zwembad) — blijft liggen
`Zwembad`-map, 20 GLB's + .blend/.png/.py: `zwembad_25m_wedstrijdbad`, `zwembad_instructiebad`, `zwembadkar_rvs_opbergwagen`, `zwemplankje_kickboard`, `zwemvleugels_set`, `zwemvliezen_en_paddles_set`, `pool_noodle_set`, `pullbuoy_tweekleurig`, `kurkjes_drijfgordel`, `drijfmat_vlot_speelmat`, `duikringen_verzwaard_set`, `duikstaafjes_torpedo_set`, `onderwaterhoepel_zwevend`, `gatzeil_zwemdiploma`, `reddingsboei_en_rescue_tube`, `reddingspop_duikpop`, `lesgevershaak_reddingsstang`, `waterpoloballen_set`, `waterpolodoel_drijvend`, `waterbasketbal_drijvend`.
Geen twijfelgevallen. De sectie Zwembad en de omgeving "Zwembad" in het Omgeving-paneel zijn **niet aangeraakt**.

Het filter staat in `scripts/lib/assetIgnore.ts` (reden per regel, getest in `assetIgnore.test.ts`) en is ingehaakt in `scripts/import-materials.mts`: zwembadbestanden worden bij elke run met een melding genegeerd.

## Problemen (nog niet gecorrigeerd)
- `leerling_*`: alle poses hebben één materiaal (`Mat_leerling_<naam>_blauw`) met één texture; `mat_shirt`/`mat_broek` bestaan niet. De shirtkleur komt uit de texturetint; de broek is niet apart te kleuren. Blender: per zone (shirt, broek) een eigen materiaal of kleurzone-map.
- Balk (`zaalverdeler` e.d.): hoogte 0,44 m vs. naam 30 cm — Blender: controleer of de logo-/klittenbandlaag buiten de 0,30 m steekt, of hernoem de maat.
- Vijf namen voor één geometrie (blokken en balk): kies één naam; de andere bestanden kunnen uit de importmap.

## Productiecommando's
Nog niet van toepassing: er is niets verwerkt. Zodra de vragen hierboven beantwoord zijn, volgt hier de volgorde (back-up → `npm run import:materials -- --dry-run` → upload → deploy), zoals in `docs/students.md`.

## Open vragen
1. Blokken en balk: welke naam, en mogen ze als de voorgestelde twee families (3 + 1 items) erin?
2. Balk: botsingshoogte 0,30 of 0,44 m?
3. `leerling_basketbal_klaarstand`: erbij of niet?
4. De 239 opnieuw opgeslagen bestanden: vergelijken met de huidige modellen?
5. Mag ik de live catalogus lezen (Supabase-connector opnieuw inloggen), zodat "nieuw" voor de veld-/judo-/gymzaalbestanden zeker is?
