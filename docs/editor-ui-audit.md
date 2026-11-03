# UI-audit van de 3D-editor (`/plattegrond-3d`)

Meting: `e2e/ui-audit.spec.ts` (alleen op verzoek: `UI_AUDIT=1 PLAYWRIGHT_CHROMIUM_PATH=… npx playwright test e2e/ui-audit.spec.ts --project=desktop`).
Per viewport meet het script alle bedieningselementen (knoppen, links, inputs, tabs), of ze volledig in beeld zijn (gecorrigeerd voor afknippen door
scrollcontainers) en of tikdoelen < 44 px zijn, met een lege plattegrond en met een geselecteerd item. Ruwe data en screenshots: `docs/editor-ui-audit/`
(`data-<viewport>.json`, `<viewport>-leeg.png`, `<viewport>-selectie.png`). Viewports: 1366×768, 1920×1080, 1024×768, 820×1180, 375×667, 390×844, 412×915.

## Belangrijkste bevindingen (gemeten)
| # | bevinding | gemeten | status |
| --- | --- | --- | --- |
| 1 | **Camerastanden, raster en botsing staan onderaan het lange rechterpaneel (Kamer)**, buiten beeld op elke desktopgrootte. Op 1366×768 staat "Botsing" op y = 1661, het raster op y = 1747 en "Bovenaanzicht"/"Vrij draaien" op y = 1825 px (scherm 768 px hoog). Ook op 1920×1080 liggen ze onder de vouw (y ≥ 1.6k). | `data-1366x768.json`, `data-1920x1080.json` | **opgelost**: zwevende canvaswerkbalk (zie onder) |
| 2 | **Selectiebalk telefoon:** 10 knoppen × 46 px = 460 px in een container van 390 px met `justify-center` + `overflow-x-auto`. De eerste knop ("Links draaien") begon op x = −11 en "Klaar" eindigde op x = 401: de linkerkant van een gecentreerde, scrollende rij is onbereikbaar. | `data-390x844.json` (ook 375/412) | **opgelost**: rij loopt door naar twee regels (alle knoppen in beeld, ≥ 44 px) |
| 3 | Rechterpaneel: acties voor het geselecteerde item (Dupliceren, Verwijderen, Vergrendelen) staan in de scrollende inhoud, niet in een vaste voet; de Kamer-tab bevat zowel instellingen als camera, raster en botsing in één scrollcontainer (`w-72`, `overflow-y-auto`). | code + meting | open (voorstel hieronder) |
| 4 | Linkerpaneel (bibliotheek): zoek, sportfilter en categorielijst scrollen samen in één container (`w-64`); categorie-koppen zijn niet sticky; op 1366×768 vallen 6 van 7 categorieën onder de vouw. | `data-1366x768.json` | open |
| 5 | Tikdoelen < 44 px op tablet (1024×768, aanrakend scherm): 35 elementen (rasterknoppen 36 px, sportlijnen-chips 36 px, `Alle muren weg` 36 px). | `data-1024x768.json` | open |
| 6 | Statusindicatoren: opslaan-status staat alleen in de knop ("Opslaan…"); geen "Opgeslagen / Niet opgeslagen" label; actieve tool wel zichtbaar (aria-pressed/gekleurde knop); geselecteerd item met naam alleen op mobiel (titel in de selectiebalk). | code | open |
| 7 | Layoutverschuiving bij openen van panelen: telefoon/tablet gebruiken overlays (drawers/zijpaneel); desktop gebruikt vaste kolommen. Geen CLS gemeten; de nieuwe werkbalk verschuift het canvas niet (getest). | e2e | ok |
| 8 | Horizontale pagina-overflow | `overflowX: false` op alle viewports | ok |

Aantallen (lege plattegrond): 74 bedieningselementen op desktop (31–34 buiten beeld door scrollcontainers, vooral de lange paneellijsten), 13 op telefoon (1 buiten beeld = verborgen bestandsinput).

## Functie-overzicht (inschatting gebruik, plek voor → na)
Gebruik is een schatting; klikken/scrolls zijn geteld uit de huidige indeling, niet met een stopwatch gemeten.
| functie | gebruik | voor | na | zonder scrollen zichtbaar? |
| --- | --- | --- | --- | --- |
| Opslaan, undo/redo | constant | bovenbalk | ongewijzigd | ja |
| Camera (Standaard/Boven/Vrij/Reset) | vaak | Kamer-tab, onderaan (scroll ±1100 px) | canvaswerkbalk + Kamer-tab (zelfde state) | nee → **ja** |
| Raster aan/uit + stap | vaak | Kamer-tab, onderaan | canvaswerkbalk (1 klik = volgende stap) | nee → **ja** |
| Botsing aan/uit | vaak | zijbalk-knop + Kamer-tab | canvaswerkbalk + zijbalk | ja (zijbalk) → ja |
| Zoeken / sportfilter / categorieën | constant | linkerpaneel, scrollt mee | ongewijzigd | zoeken ja; categorieën deels |
| Roteren, kantelen, dupliceren, verwijderen, vergrendelen | vaak | Item-tab rechts (scrollt) / selectiebalk telefoon | telefoon: alle knoppen in beeld; desktop: ongewijzigd (voorstel: zwevende contextbalk) | telefoon ja; desktop niet altijd |
| Veld afzetten, touw | vaak | zijbalk | ongewijzigd | ja |
| Kopiëren/plakken | vaak | sneltoetsen, Item-tab, selectiebalk | ongewijzigd | ja |
| Kamer: afmetingen, varianten, vaste onderdelen | soms | Kamer-tab | ongewijzigd | nee (scroll) |
| JSON, exporteren, hulp | zelden | bovenbalk/Meer | ongewijzigd | ja |

## Taken in acties (inschatting uit de code, niet gemeten)
| taak | voor | na |
| --- | --- | --- |
| Bank plaatsen en 90° draaien | categorie openen, item klikken, [desktop: Item-tab, 90°-knop onder scroll] | desktop: idem; telefoon: tikken, tikken, "90°" in de balk |
| Bovenaanzicht | Kamer-tab → scrollen → "Bovenaanzicht" (1 klik + ±3 scrolls) | 1 klik op de werkbalk |
| Raster wisselen | Kamer-tab → scrollen → knop (1 klik + scrolls) | 1 klik per stap |
| Item verwijderen | selecteren + Delete-toets of knop onderaan Item-tab | ongewijzigd |
| Opslaan | 1 klik | 1 klik |

## Benchmark (patronen, geen kopieën)
* **Figma UI3** — resizable en inklapbare panelen, werkbalk onderin, "Minimize UI" voor een schoon canvas; kritiek op de vaste onderwerkbalk (kan niet verplaatst of verborgen worden) → daarom is onze werkbalk verplaatsbaar (onder/boven) en te verbergen. Bronnen: [Navigating UI3 (Figma Help, mirror)](https://hn.jakechampion.name/reader/https://help.figma.com/hc/en-us/articles/23954856027159-Navigating-UI3-Figma-s-new-UI), [forumklacht bottom bar](https://forum.figma.com/ask-the-community-7/124-5-7-release-shows-no-bottom-floating-bar-at-work-13538), [Creative Bloq](https://www.creativebloq.com/web-design/i-cant-tell-you-how-scary-it-is-figmas-redesign-is-a-big-deal-for-figma).
* **tldraw** — contextbalk die over de selectie zweeft, alleen in de rustige selectiestand (niet tijdens draaien/slepen), klikken op de balk deselecteert niet. Bron: [tldraw context toolbar](https://tldraw.dev/examples/context-toolbar).
* **Material Design / Android** — sleephandvat van een bottom sheet minimaal 48 dp; aanrakingsdoel 48 dp (wij gebruiken ≥ 44 px). Bron: [Material Components Android, BottomSheet](https://super12138.github.io/material-components-android/components/BottomSheet.html).
* **Niet onderzocht** (geen betrouwbare bron binnengehaald): Spline, Canva, YouTube Create, Planner 5D, Floorplanner, SketchUp Web, Excalidraw, Sweet Home 3D. De patronen uit je opdracht (rechterpaneel zonder/met selectie, persistente actiebalk boven het sheet, lage drempel voor beginners) heb ik dus niet zelf geverifieerd.

## Ontwerpbesluiten
1. Wat constant of vaak nodig is (camera, raster, botsing) staat in een **zwevende werkbalk op het canvas** (desktop), standaard onderin midden; positie onder/boven/verborgen en "Reset indeling" worden onthouden in één localStorage-object met versienummer (`gymwiki.editor.ui`, `lib/editor-ui/layoutPrefs.ts`, veilige fallback). De werkbalk is een overlay: het canvas verandert niet van grootte (getest).
2. Eén state, twee plekken: werkbalk en Kamer-paneel sturen dezelfde `cameraMode`/`snapGrid`/`collisionOn` aan; geen dubbele logica. Het paneel blijft als secundaire plek.
3. Feature flag: `flags.canvasToolbar` in hetzelfde localStorage-object (standaard aan); op `false` valt de editor terug op de oude indeling.
4. De selectiebalk op telefoon laat alle acties zien (twee regels) in plaats van een scrollende, links afgeknipte rij.

## Wat is gebouwd
Audit-spec en rapport; canvaswerkbalk (camera, raster, botsing, positie, verbergen, Reset indeling) met unit tests voor de prefs en Playwright-tests op 1366×768, 1920×1080, 1024×768 (primaire acties in beeld, canvas verschuift niet, positie onthouden, Reset); selectiebalk-fix op telefoon (alle knoppen in beeld en ≥ 44 px, iPhone 14 en Pixel 7).

## Niet gebouwd (open punten)
Bovenbalk-statuslabel ("Opgeslagen/Niet opgeslagen"), titel direct bewerkbaar op desktop, vaste kop/voet in het rechterpaneel, accordeons met onthouden staat, inklapbare en verbreedbare panelen (breedte onthouden), sticky categorieën en snelsprong, virtualisatie van de bibliotheeklijst, zwevende contextbalk bij het item op desktop, Focus-modus, command palette (Ctrl+K), sneltoetsenoverzicht (`?`), startkaart voor een lege plattegrond, tikdoelen 44 px op tablet, telefoon-bottom-sheet met drie standen, taaktests met klikteller, axe-check, voor/na-video, CLS/INP-metingen en vergelijkende voor/na-screenshots (alleen de "voor"-screenshots staan in `docs/editor-ui-audit/`).

## Beslissingen voor jou
* Standaardpositie van de werkbalk: onder (nu) of boven? Figma kreeg kritiek op "onder"; hier is hij daarom verplaatsbaar.
* Moet de werkbalk ook Selecteren/Veld/Touw bevatten (nu staan die in de linkerzijbalk) en zoomknoppen?
