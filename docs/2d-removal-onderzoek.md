# 2D-editor verwijderen — onderzoek (stap 1)

## Wat is "de 2D-editor"?
Geen aparte route, maar de Konva-tekenaar `components/canvas/*` (GymCanvas, FullscreenDiagramEditor, MaterialPicker,
element-icons, field-presets, gym-canvas-types; ~3.800 regels) als volledig-schermdialoog in de activiteit-wizard
(`components/activity-wizard-page.tsx`, "Plattegrond bewerken"). Daaraan hangen:

- `app/(protected)/les-maken/lesson-form.tsx`: `diagram`-state, `handleDiagramSave`, `uploadDiagramImage`, referentie-afbeelding
  uit een import (`ImportImageReviewBanner` → "natekenreferentie").
- `app/(protected)/les-maken/page.tsx` + `lesson-flow.tsx`: `initialDiagram`.
- `actions/lesson.ts`: `diagram`-parameter van `saveLessonDraft`/`createLesson` (schrijft `diagram_data` + `diagram_image_url`).
- `types/lesson.ts`, `components/pdf/LessonPdfButton.tsx`, `actions/teamLibrary.ts`: kolomnamen.
- Teksten/ingangen: snelle actie "Zaal-Plattegrond Tekenen" (`/les-maken?tab=voorbereiding`), landingspagina ("één canvas-editor"),
  over-gymwiki, de "3D (beta)"-knop.
- Dependencies die alleen de 2D-editor gebruikt: `konva`, `react-konva`.

Oude 2D-routes bestaan niet (geen `next.config`-redirects). Enige oude ingang: de deeplink `/les-maken?tab=voorbereiding`.

## Opslag
| Kolom (`activiteiten`) | Inhoud |
| --- | --- |
| `diagram_data` (jsonb) | 2D-tekening (alleen 2 activiteiten) |
| `diagram_image_url` | afbeelding (203× storage-URL, 2× base64) |
| `afbeelding` | afbeelding in bucket `activiteit-afbeeldingen` (of automatische 3D-thumbnail) |
| `floorplans_3d.activiteit_id` | 3D-plattegrond (eigenaar = auteur van de activiteit) |

## Aantallen productie (206 activiteiten, alleen gelezen)
| | aantal |
| --- | ---: |
| alleen afbeelding | 205 |
| alleen 3D | 0 |
| afbeelding + 3D | 0 |
| geen van beide | 1 |

`floorplans_3d`: 17 rijen, 0 gekoppeld aan een activiteit. `afbeelding` en `diagram_image_url` zijn bij 203 van de 204
activiteiten met beide dezelfde afbeelding; daarom geldt overal `afbeelding ?? diagram_image_url`.

## Waar afbeeldingen getoond worden
Detailpagina (wizard- én eenvoudige variant), bibliotheekkaarten (`library-item-card`, `my-activity-card`), deelpagina
`/les/share/[id]`, publieke SEO-pagina's (`PublicActivityCard`, `/activiteiten/[slug]` + OG/Twitter), PDF-export
(`lib/pdf/arrangementImage.ts`), landingspagina-preview (`lib/services/landing.ts`).

## Bundel vóór de wijziging
`npm run check:bundle-size`: 132 client-chunks, 4,71 MB.
