# Stapelen als standaard (vervangt de botsingsknop)

## Oorzaak van het "erin zakken" (met bewijs)
Met de botsingslagen (vorige taak) werd stapelen alleen nog toegestaan op items waarvan de database `stackable = true` heeft
(`resolvePlacement`: `dimsOf(other).stackable`). In `materiaal-import/*.json` staat `stackable: false` bij o.a. springbok, springpaard,
evenwichtsbalk, trampolines, plankoline, rekstok, airtracks en brug; alles wat daarop (of daarin) werd gezet kreeg `y = vloer` en een
overlapwaarschuwing: het zakte erin. Ook was de drempel "20% van de KLEINSTE voetafdruk", wat bij een grote ondergrond makkelijk te weinig of
juist te veel was, en bij het laden (`recomputeStackedYs`) gold dezelfde `stackable`-vlag.

## Nieuwe regels
* **Ondergrond** (`supportsOthers`, `lib/constants/collisionRules.ts`): lagen *toestel* (banken, kasten, bokken, trampolines, balken, karren, fitnessbanken, …) en *vloer* (matten). De `stackable`-vlag uit de database bepaalt dit niet meer.
* **Wat mag erop** (`canRestOn`): alles behalve *overspannend* (netten, touwen, linten, klimnetten: eigen hoogte) en *decor* (vaste wandonderdelen). *Vloer*-items (matten) blijven op de vloer, behalve mat-op-mat. Palen, ballen, pionnen, leerlingen en toestellen rusten op toestellen en matten.
* **Draagt het?** Het zwaartepunt van het gesleepte item ligt op de ondergrond, óf minstens 30% van zijn voetafdruk steunt erop (`STACK_OVERLAP_MIN`). Anders valt het naar een lagere ondergrond of de vloer. Bij meerdere ondergronden wint de hoogste.
* **Meerdere lagen** werken (bal op kast op bank); er is geen aparte limiet van 4 lagen ingebouwd (de hoogte volgt uit de gestapelde items).
* **Eén berekening** voor preview en commit (`resolvePlacement`), loslaten legt exact de laatste preview vast.
* **Stapelen uit:** geen ondergronddetectie en geen waarschuwing; het item staat op de vloer ("Vrij in hoogte" wint altijd). Alleen "past niet in de zaal" blijft een melding.
* **Alt** tijdens het slepen draait stapelen tijdelijk om en zet snappen uit.
* **Ondergrond verplaatst of verwijderd:** items erop reizen mee (bestond al). Bij verwijderen vallen items naar de volgende ondergrond of de vloer, met melding ("N objecten vallen naar beneden") en één undo-stap.
* **Laden:** `recomputeStackedYs` rekent alleen items die al boven de vloer stonden opnieuw op hun ondergrond; een item op vloerhoogte blijft staan (zo blijft iets dat bewust *in* een ander object staat bij herladen ongewijzigd).
* **Op ondergrond zetten:** knop in het itempaneel (één undo-stap) brengt het geselecteerde item op de ondergrond onder zijn voetafdruk.
* **Instelling:** per gebruiker in `localStorage` (`gymwiki.editor.ui`, veld `stacking`), standaard aan; oude waarden (botsing waarschuwen/negeren) bestaan niet meer en vallen op aan. Niet in de plattegrond-JSON.

## Classificatie van assets
De laag volgt uit de slug (`SLUG_RULES`, met per-asset overrides in `COLLISION_OVERRIDES`). Het volledige overzicht staat in
`docs/stapelen-assets.csv` (gegenereerd met `scripts/audit-stapelen.ts`): 211 assets, waarvan ~56 ondergrond-toestellen, 14 matten/vloeritems, 88 klein materiaal,
23 overspannend, 14 staand, 10 personen, 6 decor. Het is een heuristiek op de naam: loop de lijst na en voeg afwijkingen toe aan `COLLISION_OVERRIDES`
(bijv. `zaalhockeybalken_*` staan nu als toestel).

## Niet gedaan / open punten
* Subtiele indicator welk object als ondergrond dient tijdens het slepen.
* Ondergrond uit de echte mesh (convex hull/raycast): de oriented collision-box (en `parts` bij composieten) is de basis; een dakvormige of holle ondergrond (bijv. een ringenstel) draagt dus als box.
* "Alles op ondergrond zetten" voor de hele plattegrond en de actie in de mobiele contextbalk en het contextmenu.
* Kopiëren en plakken en de veld-afzettool rekenen via `recomputeStackedYs` en volgen dus dezelfde lagen-regels; apart getest is dat niet.
* Catalogusvelden `ondergrond`/`stapelbaar` per asset in de database, validator en AI-briefing zijn niet toegevoegd.
* Het slepen-en-stapelen is op toestellen niet als Playwright-test geautomatiseerd (kalibratie van scherm naar wereld bleek te onbetrouwbaar); het gedrag is met unit tests gedekt en in de browser gelogd (`mode: stack`, `y = 1,1`).
