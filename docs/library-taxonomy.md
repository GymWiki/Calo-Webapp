# Indeling van de 3D-itembibliotheek

De bibliotheek links in `/plattegrond-3d` heeft **7 hoofdcategorieën**; leerlingen staan apart onder "Personen". De indeling staat op één plek: `lib/constants/libraryTaxonomy.ts` (labels, volgorde, iconen, kleuren, subgroepen, sporten). Een nieuwe categorie, subgroep of sport toevoegen of hernoemen = alleen dat bestand aanpassen.

| Categorie | Voorbeelden | Subgroepen |
| --- | --- | --- |
| Toestellen | banken, bruggen, balken, klimtoestellen, kasten, springtoestellen, ringen, rekstokken | Banken, Kasten, Springen, Hangen & zwaaien, Balanceren, Klimmen |
| Doelen & netten | doelen, basket-/korfbalpalen, badminton- en volleybalnetten | — |
| Ballen | alle ballen | Basketbal, Voetbal, Volley/Hand, Overig |
| Matten | turnmatten, lange/dikke matten, airtracks | — |
| Klein materiaal | pionnen/dopjes, hoepels, springtouwen, fluitjes, hesjes, sticks en rackets | Afzetten & markeren, Sticks & rackets, Overig |
| Fitness | losse fitnessmaterialen | — |
| Opslag & karren | ballenkarren, ballenrekken, opbergers, EHBO en ander organisatiemateriaal | — |

## Per item

- `categorie`: precies één van de 7 (of `personen`)
- `subgroep`: optioneel, max. 2 niveaus
- `sporten[]`: minstens één (of `algemeen`), stuurt het sportfilter
- `tags[]`: vrije zoektermen
- `categorie_oud`: de oorspronkelijke categorie, bewaard tot akkoord (kan daarna weg)

Opgeslagen plattegronden en activiteiten verwijzen naar een item via de **slug**; die verandert nooit.

## Migratie (eenmalig)

1. Draai `supabase/migrations/material_models_taxonomy.sql` in de Supabase SQL-editor (voegt kolommen en de favorietentabel toe; veilig om opnieuw te draaien).
2. `npm run migrate:categories` — dry-run, schrijft alleen `docs/category-migration-review.md` (onzekere items met reden).
3. Controleer het rapport, daarna `npm run migrate:categories -- --apply`.

Zolang stap 1/3 niet gedaan is, deelt de app de items zelf automatisch in (dezelfde logica, `lib/library/classify.ts`), dus de bibliotheek werkt ook vóór de migratie.

## Nieuwe items

`npm run import:materials` deelt nieuwe items automatisch in (of neemt `categorie`, `subgroep`, `sporten`, `tags` uit de JSON naast het GLB) en weigert een item zonder geldige categorie en sport. Bestaande items behouden hun indeling bij her-importeren.

## In bulk aanpassen (CSV)

```
npm run library:csv -- export                    # docs/library-taxonomy.csv (opent in Excel)
npm run library:csv -- import docs/library-taxonomy.csv          # dry-run: toont wijzigingen
npm run library:csv -- import docs/library-taxonomy.csv --apply  # schrijft naar Supabase
```

Kolommen: `slug;naam;categorie;subgroep;sporten;tags` (sporten en tags gescheiden door `|`).

## Bibliotheek-UI

- Zoeken op naam, tags, sporten en subgroep (tolerant voor meervoud en typefouten, ook delen van samenstellingen: "paal" vindt "korfbalpaal").
- Sportfilter (meerdere tegelijk, aantallen per chip, werkt over alle categorieën).
- Accordeons per categorie, standaard dicht; bij zoeken/filteren klappen alleen categorieën met resultaten open.
- "Favorieten" (ster; Supabase met localStorage als terugval) en "Recent gebruikt" (laatste 8) bovenaan.
- Weergave: grote kaarten of compacte lijst (wordt onthouden).
- Mobiel: dezelfde bibliotheek in de onderste drawer.
