# Vloermarkeringen: officiële maten en wat er in de zaal past

Onderzocht op 2026-11-04 (webonderzoek, standaard zoekopdrachten). Alles wat niet in een bron is teruggevonden staat als **ONBEKEND** met de keuze die ik heb gemaakt; die waarden hebben `verified: false`
in `lib/constants/courtMarkings.ts` en moeten door jou worden bevestigd.

## Bronnen en maten
| sport / variant | officiële maat | vrije ruimte | bron | status |
| --- | --- | --- | --- | --- |
| Volleybal | veld 18 × 9 m | ≥ 3 m rondom (vrije zone) | [Special Olympics NL volleybalreglement 2022](https://specialolympics.nl/wp-content/uploads/2023/08/volleybal-reglement-2022-nl.pdf) (volgt Nevobo-regels); Nevobo-documenten zelf gaven de maat niet terug ([wedstrijdreglement](https://cdn.nevobo.nl/files/WR-Hoofdstuk-1-Volleybal-Competitie-juni-24.pdf)) | maat gevonden; **minimum voor gymzalen (2 m) gekozen = ONBEKEND** |
| Minivolleybal / jeugdvormen | ONBEKEND (een Wikipedia-mirror noemt 9 × 9 m zonder bronvermelding) | ONBEKEND | niet gevonden | niet in de config |
| Badminton | dubbel 13,40 × 6,10 m, enkel 13,40 × 5,18 m; net 6,10 m, 1,524 m hoog; vrije hoogte ≥ 11 m (oudere versie) | 2 m achter, 1,5 m opzij is een Schotse indicatie | [Badminton Nederland, Uitvoeringsregeling Accommodatievoorschriften 2023-2024](https://oud-jul2024.badminton.nl/uploads/documents/reglementen/Wedstrijden/Uitvoeringsregeling-Accommodatievoorschriften-Badminton-Nederland-2023-2024.pdf), [Sport Scotland](https://sportscotland.org.uk/media/ucxd30mw/021_-_badminton_court.pdf) | maat gevonden; **0,3 m onderwijsminimum gekozen = ONBEKEND**; controleer de actuele versie op badminton.nl |
| Basketbal | 28 × 15 m (in de praktijk vaak 26 × 14 m) | ONBEKEND | [NBB-minispelregels](https://www.basketball.nl/documents/32/Minispelregels2010versiedec3.pdf), [NBB-informatieblad indoor accommodatie 2024](https://basketball.nl/documents/1539/NBB_Informatieblad_indoor_accommodatie_voor_basketball_5-5_versie_2024-05-01.pdf) (de cijfers zelf uit de samenvatting) | maat gevonden; jeugd/mini/dwarsveld **ONBEKEND** (12 × 20 niet bevestigd) |
| Handbal | 40 × 20 m | ONBEKEND | [NHV 4.2 Speelwijze schoolhandbaltoernooien](https://www.handbal.nl/wp-content/uploads/2024/01/4.2.-Speelwijze-schoolhandbaltoernooien.pdf) | maat gevonden; uitloopruimte **ONBEKEND** |
| Zaalvoetbal | lengte 38–42 m, breedte 18–25 m (ere-/eerste divisie 20–25 m) | ≥ 2 m obstakelvrij | [KNVB kwaliteitsnormen zaalvoetbalaccommodaties](https://www.knvb.nl/downloads/bestand/1940/zaalvoetbalaccommodaties-kwaliteitsnormen) | gevonden |
| Korfbal (zaal) | ONBEKEND | ONBEKEND | [KNKV Handboek Kwaliteitseisen Korfbalaccommodaties](https://www.knkv.nl/app/uploads/2020/08/Handboek-Kwaliteitseisen-Korfbalaccommodaties.pdf) (PDF niet uitgelezen) | **ONBEKEND** |
| Zaalhockey | ONBEKEND | ONBEKEND | KNHB: geen bron gevonden | **ONBEKEND** |
| Gymzalen | basis (basisonderwijs) 24 × 14 m, obstakelvrije hoogte 5,5 m (voortgezet 7 m); sporthal 47 × 26 m, 11 m | – | [KVLO-tabel (gemeente Alkmaar)](https://alkmaar.bestuurlijkeinformatie.nl/Document/View/5d6e6f42-8da6-48c2-809e-5cca33acb3fb); normen NOC*NSF volgens de NBB niet meer van toepassing (nieuw kwaliteitszorgsysteem) | 24 × 14 bevestigd; **12 × 21, 14 × 24, 15 × 27 en 24 × 44 niet teruggevonden** |

## Bestaande lijnen (gemeten in `gymzaal_standaard.glb`) tegen de officiële maat
Gemeten als omhullende van de `Lijnen_*`-nodes (x × z in m); lijndikte zit in de maat (± 2 × 2 cm).
| node | gemeten | officieel | afwijking / opmerking |
| --- | --- | --- | --- |
| Lijnen_Badminton | 13,44 × 6,14 | 13,40 × 6,10 | +4 cm = lijndikte: klopt |
| Lijnen_Badminton_Dwarsvelden | 20,74 × 12,44 | 3 × (13,40 × 6,10) | tekent drie banen van ca. 6,9 × 12,4: **te kort (12,4 i.p.v. 13,4 m)** |
| Lijnen_Volleybal | 18,70 × 12,50 | 18 × 9 | 12,5 m breed: bevat meer dan de 9 m speelveld (waarschijnlijk vrije-zone- of hulplijnen); **afwijkend** |
| Lijnen_Volleybal_Dwarsvelden | 20,45 × 11,05 | 3 × (18 × 9) | drie verkleinde velden: **bestaan niet; past nergens** |
| Lijnen_Basketbal | 20,66 × 11,05 | 28 × 15 (26 × 14) | verkleind schoolveld, geen reglement voor die maat: ONBEKEND |
| Lijnen_Handbal | 22,08 × 13,18 | 40 × 20 | verkleind: ONBEKEND |
| Lijnen_Zaalvoetbal | 22,08 × 13,43 | 38–42 × 18–25 | verkleind (kleinveld): ONBEKEND |
| Lijnen_Zaalkorfbal / Zaalhockey / Tennis | 22,05 × 13,05 / 22,05 × 13,05 / 22,05 × 10,20 | ONBEKEND / ONBEKEND / 23,77 × 10,97 | ONBEKEND |

De lijntekeningen zelf (middencirkel, driepuntslijnen, 3 m-lijn, doelgebieden, …) zitten in de GLB's en zijn **niet** aangepast: dat moet in Blender (nieuwe `Lijnen_*`-meshes op de officiële maten). Dat is niet gebeurd.

## Wat er gebouwd is
* `lib/constants/courtMarkings.ts`: config per sport en variant (maat, minimale en officiële vrije ruimte, oriëntaties, kleur, lijndikte, koppeling met de lijn-nodes, bron, `verified`).
* `lib/plattegrond/courtFit.ts`: `computeMaxCopies`, `fitsInHall`, `misfitReason`, `hallHint`, `invalidMarkings` (getest in `courtFit.test.ts` met de maten hierboven).
* Kamer-paneel → "Vloermarkeringen" (accordeon): knoppen met kleurstip; niet-passende markeringen zijn gedimd met reden ("Past niet in 24 × 14 m: minimaal … nodig"), hint "Deze zaal past: …", en bij een bestaande plattegrond met een ongeldige combinatie een waarschuwing met "Herstel" (zet de ongeldige uit; de plattegrond blijft verder ongewijzigd).
* In een zaal van 24 × 14 m: volleybal 1 veld, badminton tot 3 velden; "Volleybal (3 dwarsvelden)" is niet te kiezen.

## Niet gebouwd (open)
Stepper per sport met aantallen en "Standaardmarkering"/"Geen markeringen", markeringen per zaalnummer (deelzaal) in het datamodel (nu schakelt het bestaande per-zaal-node-systeem), lijngeometrie corrigeren (Blender), minimale lijnbreedte in pixels bij uitzoomen, snap van netten/doelen aan markeringen, validatie in de JSON-validator (`npm run validate:plattegrond`), AI-briefing, zaalpresets-vergelijking, voor/na-screenshots. Bij een eigen zaalmaat bestaat niet (alleen de vaste indelingen); de hint gebruikt de deelzaalmaat 24 × 14 m.
