# Materiaal-families met kiesbare maten

Stand 5 november 2026. Basislijn: de catalogus die de repo kent (211 collision-profielen, `components/canvas-3d/collision-profiles.generated.ts`) en de snapshot van 184 modellen. De live catalogus (Supabase) was niet te lezen: de connector vroeg om een inlogstap.

## Wat is gebouwd (aanpak 4: variantmodellen)
- **Config:** `lib/constants/itemFamilies.ts` (het repo gebruikt `lib/`, niet `src/config/`). Per familie: id, naam, standaardmaat, weergave (segment, lijst of stepper), maattitel en de maten (id, label, slug, zoektermen).
- **Aliassen zonder migratie:** de slug van elke maat is het bestaande item-id. Een geplaatst item houdt `slug` in de plattegrond-JSON; er komt geen `maat`-veld bij en er verandert niets aan bestaande plattegronden, activiteiten of exports. De alias-tabel (slug → familie + maat) wordt afgeleid uit de config (`familyOfSlug`), en een test bewaakt dat elke slug in precies één familie zit en in de catalogus bestaat.
- **Bibliotheek:** één kaart per familie met een label "N maten" en een tooltip met de maatnamen (`lib/library/families.ts`, `buildFamilyCards`). Zoeken en sportfilters vinden de familie via alle maatnamen; categorieaantallen kloppen vanzelf. Plaatsen gebruikt de laatst gebruikte maat (per browser), anders de standaardmaat. Recent en favorieten blijven werken (een eerder geplaatste maat verwijst naar de kaart).
- **Itempaneel (desktop en mobiele drawer):** sectie "Maat" (`components/library/MaatPanel.tsx`): segmentknoppen, lijst of stepper (turnkast: "Kastdelen – 4 delen +"), met de afmetingen b × d × h. Maten zonder model worden niet getoond. Tikdoelen zijn 44 px op touch. Na het plaatsen van een familie opent het itempaneel (zoals bij leerlingen).
- **Maatwissel:** positie, rotatie, kleur en vergrendeling blijven; de onderkant blijft op de vloer of ondergrond (pivot onderkant-midden); wat erbovenop staat gaat mee (`recomputeStackedYs`); collision en anchors volgen de nieuwe slug; één undo-stap per wissel; een zachte waarschuwing als de maat buiten de zaal valt. Meerdere items van dezelfde familie: de maat geldt voor allemaal.
- **Materiaal nodig / AI / validator:** omdat de slug de sleutel blijft, telt het overzicht al per maat ("Turnkast 4 delig: 2"), accepteert de validator de bestaande slugs en kan een gegenereerde plattegrond een maat kiezen door de slug te noemen. Een onbekende maat bestaat dus niet (een onbekende slug geeft al de bestaande melding).

## Families (35 losse kaarten → 14)
| Familie | Huidige items (slug → maat) | Afmetingen (b × d × h, m) | Kaarten voor → na |
| --- | --- | --- | --- |
| Basketbal | `basketbal_maat_5` (Maat 5), `basketbal_maat_7` (Maat 7); **maat 6: model ontbreekt (verborgen)** | ⌀ 0,220 / 0,239 | 2 → 1 |
| Turnkast | `turnkast_1_delig_kastkop` … `turnkast_7_delig_2_recht` (1 t/m 7 delen); `turnkast_140x83x114` = alias van 5 delen | 1,42 × 0,54 × 0,30 tot 1,55 × 0,86 × 1,565; elk deel +0,21 m | 8 → 1 |
| Foambal | klein 7 cm, middel 16 cm, groot 20 cm | ⌀ 0,07 / 0,16 / 0,20 | 3 → 1 |
| Veldhockeydoel | 1,80 × 1,20 m jeugd, 3,66 × 2,14 m | 1,90 × 0,90 × 1,25; 3,88 × 1,32 × 2,20 | 2 → 1 |
| Veldvoetbaldoel | 5,00 × 2,00 m, 7,32 × 2,44 m | 5,28 × 1,60 × 2,11; 7,60 × 2,10 × 2,55 | 2 → 1 |
| Zaalhockeybalk | 2 m, 4 m | 2,06 / 4,06 × 0,10 × 0,105 | 2 → 1 |
| Lange mat (oprolbaar) | 6 m, 12 m | 6,0 / 12,0 × 2,0 × 0,04 | 2 → 1 |
| Korfbalpaal met korf | 2,50 m, 3,50 m | 0,91 × 0,80 × 2,50 / 3,50 | 2 → 1 |
| Basketbaltoren (mobiel) | jeugd, senior | 1,87 × 3,52 × 3,38 / 3,83 | 2 → 1 |
| Springbok | laag 80 cm, standaard 105 cm | 0,73 × 0,60 × 0,84; 0,89 × 0,74 × 1,09 | 2 → 1 |
| Dodgeball (vinyl) | blauw, rood | ⌀ 0,178 | 2 → 1 |
| Foambal olifantenhuid | geel (0,16), rood (0,18) | ⌀ 0,16 / 0,18 | 2 → 1 |
| Airtrack | 6 m, 12 m | 6,03 / 12,03 × 2,05 × 0,20 | 2 → 1 |
| Klimtouwen (hangend) | 2 touwen, 4 touwen | 1,10 / 2,10 × 0,08 × 5,03 | 2 → 1 |

Totaal 35 → 14 kaarten (−21), inclusief de twee kleurfamilies (dodgeball, foambal olifantenhuid) en het verborgen dubbele model. In de bibliotheek verschijnt een familie alleen als er minstens twee modellen van aanwezig zijn; anders blijft het een gewoon item.

## Blijft bewust los
EHBO-koffer, ballenpomp, scorebord, tafeltennis, vaste zaalonderdelen (wandrekken, basketbalborden in de zaal), de leerlingen (hebben al eigen pose en grootte), de volleybal- en badmintonopstellingen (zie "Nog niet"), trampolines, `turnbank_1_los` en `turnbank_4_stapel` (een stapel, geen maat), `foamturnkast_*` (4-delig en een los topdeel), alle pionnen, dopjes en sets.

## Aanpak per familie: wat kan er later nog
| Aanpak | Geschikt voor | Status |
| --- | --- | --- |
| 1. Uniform schalen | ballen, pionnen, hoepels, medicijnballen | **Niet gebouwd.** Vereist eerst de keuze welke ballen per sport "maat" worden (zie beslissingen). |
| 2. Schalen per as | matten, banken | **Niet gebouwd.** Matten hebben afgeronde randen: eerst per model beoordelen of de naden blijven staan. |
| 3. Modulair | turnkast (onderstuk + n delen + leer) | **Voorbereid:** de turnkast is al een stepper en elk deel is +0,21 m (getest). Echte opbouw uit onderdelen vraagt losse GLB's (zie modellenlijst). |
| 4. Variantmodellen | doelen, palen, hordes, de families hierboven | **Gebouwd.** |
| Parametrisch (net- en paalhoogte) | volleybal, badminton | **Niet gebouwd:** de huidige opstellingen zijn één GLB; hoogte per net vraagt losse onderdelen. |

## Bronnen voor maten (opgezocht op 5 november 2026)
| Onderwerp | Waarde | Bron | Status |
| --- | --- | --- | --- |
| Basketbal maat 5 / 6 / 7 | omtrek 70 / 72 / 75 cm | [Decathlon NL](https://www.decathlon.nl/sporten/basketbal/basketballen), [Decathlon BE](https://www.decathlon.be/nl/c/htc/hoe-kies-je-een-basketbal_f7af15c0-9fb8-496e-ac4f-319cbdc3029a) | Winkelbron, geen NBB-norm. Leeftijdsgrenzen **tegenstrijdig** tussen NL en BE: **ONBEKEND**. |
| Badminton paal / net | palen 1,55 m; midden 1,524 m; net 760 mm hoog, ≥ 6,10 m breed | [Badminton Nederland spelregels](https://badminton.nl/uploads/documents/reglementen/Algemeen/Spelregels-25-6-2024.pdf), [accommodatievoorschriften](https://oud-jul2024.badminton.nl/uploads/documents/reglementen/Wedstrijden/Uitvoeringsregeling-Accommodatievoorschriften-Badminton-Nederland-2023-2024.pdf) | Officieel |
| Handbaldoel | 3,00 × 2,00 m | [Skor](https://skor.nl/en/collections/handbaldoel) (verwijst naar NHV) | Winkelbron |
| Hockeydoel | 3,66 × 2,14 m; zaalhockey 3 × 2 m | [Skor](https://skor.nl/en/products/inklapbaar-zaalhockeydoel-3x-2m) | Winkelbron, geen KNHB-norm |
| Korfbalpaal | 3,50 m (76 mm) | [KNKV handboek accommodaties](https://magazine.knkv.nl/handboek-kwaliteitseisen-korfbalaccommodaties/belijning) (hoogte daar niet bevestigd) | **2,50 m jeugd: ONBEKEND** (bron niet gevonden) |
| Volleybal nethoogtes (heren, dames, jeugd, mini) | — | [Nevobo reglementen](https://www.nevobo.nl/wedstrijdsport/regelgeving/statuten-en-reglementen/) | **ONBEKEND**: geen getal in de zoekresultaten |
| Zaalvoetbaldoel, hordehoogtes, mattenmaten, kastdelen en toestelhoogtes (onderwijs) | — | — | **ONBEKEND** |

De maatlabels in de config gebruiken de afmetingen van de bestaande modellen; waar een bron ontbreekt is dat een voorstel dat jij kunt aanpassen.

## Modellen die jij moet maken (Blender of Tripo3D)
| Model | Afmeting (m) | Pivot | Naam |
| --- | --- | --- | --- |
| Basketbal maat 6 (verborgen tot het er is) | ⌀ 0,229 (omtrek 72 cm, Decathlon; **ONBEKEND** officieel) | onderkant-midden | `basketbal_maat_6` |
| Mini-doel (zaalvoetbal/handbal) | **ONBEKEND**, voorstel 1,80 × 1,20 | onderkant-midden, voorkant +Z | `zaalvoetbal_handbaldoel_mini` |
| Volleybalnet per hoogte (jeugd/mini) | **ONBEKEND** | onderkant-midden | `volleybal_veldopstelling_hoog_<cm>` (de huidige is `_dames`) |
| Turnkast als losse onderdelen (voor de modulaire opbouw) | onderstuk, deel (1,42 × 0,54 × 0,21), leer (kastkop) | onderkant-midden, deel exact 0,21 hoog | `turnkast_onderstuk`, `turnkast_deel`, `turnkast_kastkop` |
| Matten: dikte 4/6 cm als variant | **ONBEKEND** | onderkant-midden | `turnmat_<l>x<b>x<h>` |

## Beslissingen (verwerkt op 5 november 2026)
1. **Zaaldoelen:** `zaalhockeydoel_300x200_wit` en `zaalvoetbal_handbaldoel_3x2` blijven los.
2. **Ballen:** geen families per sport. Wel een kleurkeuze voor dodgeball/trefbal en foambal (zie punt 3).
3. **Kleurvarianten:** gebouwd als aparte keuze "Kleur" (kleurbolletjes) in het itempaneel, elke kleur een eigen model: *Dodgeball (vinyl)* blauw/rood (zoekt ook op "trefbal") en *Foambal olifantenhuid* geel/rood. De kaart zegt "2 kleuren". Let op: olifantenhuid geel is 0,16 m en rood 0,18 m (de modellen verschillen dus ook in grootte; zo uit de bestanden). `trefbal_zacht_rubber` (⌀ 0,216 m) staat nog los: welke kleur is dat, en moet het erbij?
4. **`turnkast_140x83x114`:** verborgen in de bibliotheek en behandeld als alias van "5 delen" (bytegelijk). De slug blijft geldig, dus oude plattegronden laden ongewijzigd en tonen "5 delen". Uit de database verwijderen heb ik niet gedaan: dat is een productiewijziging (zie onder).
5. **Matten en banken:** apart model per maat, dus geen schalen per as. Er zijn nu geen families voor matten of banken; nieuwe maten komen als nieuwe modellen (zie lijst).
6. **Maat 6 (basketbal):** verborgen tot het model er is. Maten zonder model worden nergens meer gedimd getoond.

### Productiecommando (optioneel, door jou te draaien)
Alleen als je het dubbele model ook uit de database wilt zetten. Niet nodig voor de werking. Eerst controleren of plattegronden het nog gebruiken, dan uitzetten (terugzetten = `active = true`):
```sql
select id, naam from public.floorplans_3d where data::text like '%turnkast_140x83x114%';
create table public.material_models_dubbel_backup as select * from public.material_models where slug = 'turnkast_140x83x114';
update public.material_models set active = false where slug = 'turnkast_140x83x114';
```

## Kleuren: wat er kan
Nu zijn dat alleen de bestaande modellen. Een willekeurige kleur per item (zoals het shirt van een leerling) kan voor ballen met een egaal wit basismateriaal; bij de huidige GLB's met texturen wordt een tint donker en vuil. Wil je meer kleuren (bijv. trefbal in geel of groen, foambal klein/middel/groot in kleur), dan is de eenvoudigste weg een extra model per kleur: kopieer het model in Blender, zet de basiskleur van het materiaal om en bewaar als `foambal_olifantenhuid_<kleur>` of `dodgeball_vinyl_<kleur>`, pivot onderkant-midden. Zeg het als je liever de tint-methode wilt.

## Nog niet gedaan (eerlijk)
- Contactsheet van alle families, thumbnail per maat en voor/na-screenshots van de bibliotheek.
- Contextbalk-chip "Maat" met popover (desktop): de maat wissel je nu in het itempaneel.
- Beheerweergave of CSV voor families en aliassen: de config is één TypeScript-bestand.
- Aanpak 1 (uniform), 2 (per as), 3 (modulair met onderdelen) en parametrische net-/paalhoogte, zie hierboven.
- Unit tests voor "alle opgeslagen testplattegronden laden identiek": dat is per constructie zo (slugs onveranderd) en zit in de alias-test; een volledige set echte plattegronden was in deze omgeving niet beschikbaar.
- Productiecommando's: **geen nodig** (geen migratie, geen upload). De enige nieuwe data is de config in de repo.
