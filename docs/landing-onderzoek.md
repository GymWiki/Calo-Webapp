# Landingspagina herschrijven: onderzoek

Alleen gelezen: code, en de database via leesqueries (aantallen). Niets gewijzigd.

## Wat GymWiki nu kan (uit de code)
| Functie | Route / bron | Status |
|---|---|---|
| Dashboard (snelle acties, eigen activiteiten, planning van vandaag, bijdragestatus) | `/dashboard` | live |
| Bibliotheek met zoeken, filters (categorie & leerlijn, doelgroep & groep, "weinig materiaal"), sorteren, bewaren | `/zoeken` (ingelogd) | live |
| Publieke activiteitenpagina's per activiteit, leerlijn en groep (SEO) | `/activiteiten`, `/leerlijn/…`, `/groep/…` | live |
| Activiteit maken: wizard, concepten, bewerken, doorgeven aan de bibliotheek na AI-kwaliteitscontrole | `/les-maken` | live |
| 3D-plattegrondeditor: koppelbaar aan een activiteit, ook los te gebruiken | `/plattegrond-3d` | live (in de code nog als "3D (beta)" gelabeld) |
| Gratis 3D-editor zonder account, export PNG/PDF, deellink, JSON | `/gratis-gymzaal-plattegrond-maken` | live |
| Kennisbank: vakliteratuur voor de AI Activiteitenchecker en AI Lescoach, eigen uploads + Standaardbibliotheek | `/kennisbank` | live |
| Planning: klassen en weekrooster met geplande lesmomenten | `/profiel/planning` | live |
| Delen: activiteit en lesplan delen via link, PDF-export van een activiteit | knoppen in de app, `/les/share/[id]` | live |
| Toernooi-generator (speelschema voor teams en velden) | `/toernooi` | live |
| Team (collega's uitnodigen, teambibliotheek, tags) | `/profiel/team`, `/team/uitnodiging/…` | live |
| Abonnement: gratis via bijdrage, maandelijks, jaarlijks, lifetime, teampakketten | `/pro`, `lib/constants/subscriptionPlans.ts` | live |

Freemium-model: gratis zolang je per maand 3 activiteiten deelt die de AI-kwaliteitscontrole doorstaan; anders is de bibliotheektoegang beperkt tot je eigen bijdragen. Betaald: EUR 3,- per maand, EUR 25,- per jaar, EUR 99,- eenmalig (lifetime); team: EUR 79,- / 179,- / 399,- per jaar voor 5 / 15 / 40 leden.

Doelgroepen in de data (`DOELGROEP_LABELS`): Groep 1/2, 3/4, 5/6, 7/8, Onderbouw, Bovenbouw. Er is dus geen aantoonbare aparte inhoud voor voortgezet onderwijs, verenigingen of buitenschoolse opvang.

## Echte cijfers (leesqueries op 2026-10-28) en hoe ze dynamisch blijven
| Cijfer | Waarde nu | Bron voor de pagina |
|---|---|---|
| Publieke, indexeerbare activiteiten | 205 | `count` over `activiteiten_publiek` (ISR, 1 uur) |
| Leerlijnen | 14 | distinct `leerlijn` in diezelfde rijen |
| Categorieën | 6 | distinct `categorie` |
| 3D-materialen in de bibliotheek | 178 (184 actief, waarvan 6 "personen" nu verborgen) | `count` over `material_models` zonder `personen` (anon-policy staat sinds PR #28) |
| Kennisbank-pakketten | 4 | niet gebruikt als cijfer (te klein/intern) |

Geen cijfers over gebruikers, scholen of tevredenheid gebruikt: die zijn er niet als betrouwbare bron. Geen testimonials of logo's.

## Huidige landingspagina
- Alles draait om de 3D-editor: hero, teaser, zes editor-features. De oorspronkelijke secties (waarom, collectief model, prijzen, team, bibliotheekpreview, FAQ) staan eronder.
- Metadata: title "GymWiki — Gratis 3D-gymzaal plattegrond en lesideeën LO", JSON-LD Organization, SoftwareApplication (met `operatingSystem: "Web, iOS, Android"`: dat is niet te verifiëren) en FAQPage.
- Animatie: SVG/CSS-hero (transform/opacity, pauzeert buiten beeld, reduced-motion). Geen analytics-systeem (alleen de `gymwiki:event`-hook).
- Lighthouse mobiel (lokale productiebuild): Performance 98, LCP 2,4 s, TBT 30 ms, CLS 0.
- De bibliotheekpreview leest `activiteiten` met de **service-role**-client. Die sleutel staat niet in de Vercel-productieomgeving, dus de preview en het activiteitenaantal zijn in productie waarschijnlijk altijd leeg (de pagina vangt de fout stil af). De nieuwe pagina gebruikt daarom de publieke view met de anon-client.

## Voorgestelde structuur (volgorde uit de opdracht, met twee afwijkingen)
1. Hero: "Alle activiteiten voor je gymles op één plek", CTA's Gratis beginnen / Bekijk de bibliotheek, daaronder echte activiteitkaarten (met 3D-plattegrond als zichtbaar voorbeeld).
2. Probleem → oplossing (3 punten). 3. Hoe het werkt (3 stappen). 4. Kernfuncties (5 blokken). 5. Uitgelicht: 3D-editor (met de bestaande SVG-animatie, verhuisd). 6. Voor wie. 7. Bibliotheekpreview (live). 8. Gratis en betaald (met bestaande prijskaarten). 9. Echte cijfers. 10. FAQ (8 vragen). 11. Slot-CTA.
- Afwijking 1: "Voor wie" noemt basisonderwijs, groepsleerkrachten, CALO/ALO/PABO-studenten en teams/scholen. Voortgezet onderwijs, verenigingen en buitenschoolse opvang staan er niet, want de data en code laten dat niet zien (TODO in de content).
- Afwijking 2: geen testimonials-blok, alleen echte cijfers; een TODO in de content voor toestemmingsvolle quotes.
