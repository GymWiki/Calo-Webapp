# 3D-modellen bijwerken (omgevingen, leerlingen, materiaal)

Een wijziging in de Drive moet overal doorwerken: alle plattegronden, de editor, de viewer en de bibliotheek. Plattegronden bewaren
alleen *namen* (`leerling_pose_hockey`, `gymzaal_standaard`), nooit de modellen zelf, dus een nieuw GLB geldt automatisch voor elke
plattegrond zodra het in de bucket staat en de site is gedeployed. Drie dingen moeten daarvoor kloppen, en daar zorgen de scripts voor.

| Wat | Commando | Wat het doet |
| --- | --- | --- |
| Gymzaal, sportveld, atletiekbaan, zwembad | `npm run sync:environments -- --upload` | leest `omgeving-import/*.glb`, schrijft `components/canvas-3d/environment-nodes.ts` (nodenamen + versie-hash), uploadt de GLB's |
| Leerlingposes | `npm run process:students -- --thumbs` en `npm run upload:students` | verkleint de GLB's, schrijft `lib/students/poses.generated.json` (maten + versie-hash), maakt thumbnails, uploadt |
| Overig materiaal | `npm run import:materials` | bestaand importscript |

Daarna: commit de gegenereerde bestanden, PR, merge en deploy.

## Waarom dit overal doorwerkt

- **Versie in de URL.** De hash van elk GLB staat als `?v=…` achter de model-URL (`environmentModelUrl`, `studentModels`). Een gewijzigd
  bestand krijgt dus een nieuwe URL en wordt direct geladen, ook door bezoekers met een gecachte oude versie.
- **Botsingsmaten en nodenamen komen uit het GLB.** `environment-nodes.ts` en `poses.generated.json` worden gegenereerd, niet met de hand
  bijgehouden.
- **De tests waken over de rest.** `environment-kinds.test.ts` faalt als een GLB belijning (`Lijnen_*`, `Belijning_*`, banenlijnen) bevat die
  de editor niet kan aan/uit zetten, of als de editor een onderdeel kent dat niet meer in het GLB zit. Voeg dan het onderdeel toe in
  `environments.ts` (gymzaal) of `environment-kinds.ts` (overige omgevingen).

## Bestaande plattegronden

`upgradeEnvironment` (`environment-kinds.ts`) zet opgeslagen omgevingen om naar de huidige belijning (bv. `Lijnen_Zaalvoetbal_Handbal` is
gesplitst) en houdt nieuwe extra belijning standaard uit, zodat bestaande plattegronden er niet ineens vol lijnen uitzien. Een nieuwe lijn
die je standaard áán wilt hebben, laat je zonder `defaultHidden` staan.

## Preview-afbeeldingen (bibliotheek)

De preview van een plattegrond is een statische afbeelding die bij het opslaan in de editor wordt gemaakt (1600 × 900, zie
`FloorplanThumbnailCapture`). Die verandert dus niet vanzelf als een model verandert: hij wordt ververst zodra de plattegrond opnieuw
wordt opgeslagen. De viewer zelf (activiteitpagina, editor) toont altijd de actuele modellen.
