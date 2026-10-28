# Gratis 3D-tool + landingspagina: SEO-, prestatie- en testrapport

## URL-structuur

| URL | Doel | Indexeerbaar |
|---|---|---|
| `/` | Landingspagina, de 3D-editor is het hoofdargument | ja |
| `/gratis-gymzaal-plattegrond-maken` | Gratis tool (SSR-tekst + lazy editor) | ja, canonical op zichzelf |
| `/gymzaal-indeling-maken` | Long-tail, eigen tekst en voorbeeld `circuit` | ja |
| `/opstelling-bewegingsonderwijs-tekenen` | Long-tail, voorbeeld `opstelling-turnen` | ja |
| `/veld-afzetten-met-pionnen` | Long-tail, voorbeeld `veld-afzetten` | ja |
| `/volleybalveld-indeling-gymzaal` | Long-tail, voorbeeld `volleybal` | ja |
| `/gratis-gymzaal-plattegrond-maken#p=…` | Deellink (fragment, nooit naar de server gestuurd) | zelfde pagina, geen aparte URL |
| `/gratis-gymzaal-plattegrond-maken#start` / `#voorbeeld=<id>` | Opent direct de editor / een voorbeeld | zelfde pagina |
| `/api/gratis-tool/catalogus` | Alleen-lezen itemcatalogus (CDN-cache, rate limit) | nee (robots `/api` disallow) |
| `/plattegrond-3d` | Anoniem → doorverwijzing naar de gratis tool; met `?open=`/`?activiteit=` → `/login` | nee |

Deellinks gebruiken bewust een **fragment** (`#p=`) in plaats van `?p=`: zoekmachines negeren het fragment, dus er ontstaan geen duplicate-URL's en `noindex`/canonical-trucs zijn niet nodig. Het fragment gaat ook nooit naar een server of een log.

Sitemap (`app/sitemap.ts`) en robots (`app/robots.ts`, `PUBLIC_ALLOW`) bevatten de vijf pagina's; de landingspagina, footer en de tool linken naar elkaar.

## Lighthouse (mobiel, gesimuleerde 4G + 4× CPU, Lighthouse 12.6)

Gemeten op een lokale productiebuild (`next build` + `next start`), met een lege mock-Supabase (zie "Beperkingen").

| Pagina | Performance | FCP | LCP | TBT | CLS | A11y | Best practices | SEO |
|---|---|---|---|---|---|---|---|---|
| `/` **voor** | 93 | 2,1 s | 2,9 s | 60 ms | 0 | 96 | 100 | 100 |
| `/` **na** | **98** | 1,2 s | 2,4 s | 30 ms | 0 | 96 | 100 | 100 |
| `/gratis-gymzaal-plattegrond-maken` | **97** | 1,1 s | 2,5 s | 10 ms | 0 | 96 | 100 | 100 |
| `/volleybalveld-indeling-gymzaal` | **98** | 1,1 s | 2,3 s | 10 ms | 0 | 96 | 100 | 100 |

Alle doelen (≥ 90) gehaald. CLS is 0: de poster/launcher heeft een vaste beeldverhouding en de editor opent als overlay, dus er verschuift niets. three.js/R3F zitten niet in de statische bundel van de tekstpagina's; ze laden pas na de eerste klik. `npm run check:bundle-size` blijft binnen budget.

Core Web Vitals uit het veld (CrUX/Search Console) bestaan pas na echt verkeer; de bovenstaande labwaarden zijn de maatstaf tot die er zijn.

## Keuze hero-animatie

Puur SVG + CSS-keyframes (`iso-drop`, alleen `transform`/`opacity`, ~3 kB, geen JS-frameloop). Alternatieven: Lottie (+50–200 kB JS), een video (zwaar en LCP-risico), of de echte WebGL-editor (te zwaar voor de hero). `IntersectionObserver` (`PauseOffscreen`) pauzeert de animatie buiten beeld en bij een verborgen tabblad; `prefers-reduced-motion` zet alle animaties uit en toont direct de eindstand. De interactieve teaser en de tellers (`CountUp`) respecteren hetzelfde.

## Tests

- `npm test` (node:test): `lib/guest/share-codec.test.ts` (deellink-codec, formaat- en groottegrenzen), `lib/guest/seo-content.test.ts` (titel/description-lengte, FAQ 8–10 vragen en gelijk aan het schema, SoftwareApplication/FAQPage/BreadcrumbList).
- `node scripts/check-guest-seo.mjs <basis-url>`: controleert op de ruwe HTML title, description, canonical, één H1, H2's, OG/Twitter, geldige JSON-LD, robots en sitemap voor alle vijf pagina's. Resultaat: alles geslaagd.
- Playwright (`e2e/gast-tool.spec.ts`, `e2e/landing.spec.ts`) op desktop, iPhone 14 en Pixel 7: tekstpagina zonder editor, editor starten zonder account (geen enkel schrijfverzoek), item plaatsen, lokaal herstel na sluiten, PNG 3D/bovenaanzicht en PDF downloaden, deellink openen in een nieuw venster, voorbeeld via `#voorbeeld=`, anonieme doorverwijzing, hero/CTA's, teaser, reduced-motion en pauzeren buiten beeld.
- De gast-spec draait tegen `next dev` met `E2E_HARNESS=1` (placeholder-catalogus), de landing-spec tegen een productiebuild.

## Gevonden en opgelost onderweg

- **PDF's met afbeeldingen bleven stil hangen.** `@react-pdf/renderer` start voor afbeeldingen een worker vanuit een `blob:`-URL; de CSP had geen `worker-src`. Opgelost met `worker-src 'self' blob:` in `next.config.ts` (geen externe hosts erbij). Dit raakt ook de bestaande activiteit-PDF (`ActivityPdfButton`), die dezelfde bibliotheek en CSP gebruikt. Gereproduceerd in dev én in de productiebuild.
- Twee opnames direct na elkaar (PDF: 3D + bovenaanzicht) mounten nu een nieuwe capture-component per opname.
- Gasten sturen geen favorieten-serveractie meer af (`useLibraryPrefs({ syncServer: false })`).

## Productiecommando's

**Geen databasewijzigingen.** De catalogus wordt server-side met de bestaande service-role-sleutel gelezen (`SUPABASE_SERVICE_ROLE_KEY` staat al in productie voor de Stripe-webhook) en alleen als vaste, publieke projectie (itemdefinities + publieke bucket-URL's) teruggegeven. Er is geen migratie of policy nodig, dus er hoeft niets op productie gedraaid of geback-upt te worden. Normale deploy van `main` volstaat.

## Analytics

GymWiki heeft geen analytics-systeem, dus er is **niets** gebouwd dat data verstuurt. `lib/analytics/track.ts` zet alleen een DOM-event `gymwiki:event` (`editor_gestart`, `eerste_item_geplaatst`, `export_png`, `export_pdf`, `deelbare_link`, `upsell_getoond`, `account_aangemaakt_vanuit_editor`). Later kan één provider (bijv. Plausible, cookieloos) op één plek inhaken zonder dat de aanroepers veranderen. Er is geen privacypagina in de app; zodra er analytics komt, moet die er ook komen.

## Beperkingen en open punten

- Lighthouse is gemeten met een lege mock-Supabase: de landingspagina toont daardoor geen bibliotheekkaarten. In productie kan het cijfer iets afwijken; meet na de deploy opnieuw op `https://www.gymwiki.nl`.
- Contrast: wit op het merk-oranje (`primary`) haalt de 4,5:1 niet (bestaand, A11y 96 voor én na). Een donkerder `primary` voor knoppen/tekst lost dat app-breed op, maar is een merkbeslissing.
- Voorbeeldplattegronden worden bij het openen uit de echte catalogus samengesteld op naam/slug (`lib/guest/examples.ts`); ontbreekt een item, dan wordt het overgeslagen. Controleer na de deploy of elk voorbeeld gevuld is.
- Poster en hero zijn SVG-schetsen, geen render van de echte editor: een screenshot-poster kost extra LCP-bytes en vergt echte GLB's in de testomgeving.
- De "180+ 3D-modellen" op de landingspagina is een vaste waarde; werk hem bij als de bibliotheek groeit.
- De rate limit van `/api/gratis-tool/catalogus` is per serverless-instance (in-memory) naast de CDN-cache; voor harde limieten is een gedeelde store of Vercel-firewallregel nodig.
- Geen schermopname (ffmpeg ontbreekt in de sandbox); screenshots staan in `docs/screenshots/`.
- De nieuwe geskinde leerling-GLB's zijn nog niet geüpload (A-pose-probleem); "Personen" blijft verborgen.
