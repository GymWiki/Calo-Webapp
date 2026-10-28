# Landingspagina: GymWiki als geheel (rapport)

Onderzoek en structuur: `docs/landing-onderzoek.md`. Alle teksten: `content/landing.nl.ts`. Screenshots: `docs/screenshots/landing-voor-*` en `landing-na-*`.

## Paginastructuur
1. Hero: "Alle activiteiten voor je gymles op één plek", CTA's Gratis beginnen en Bekijk de bibliotheek, daaronder echte activiteitkaarten uit de bibliotheek plus een (zo benoemde) 3D-voorbeeldtegel.
2. Probleem en oplossing (3 punten). 3. Hoe het werkt (3 stappen). 4. Kernfuncties (5 blokken). 5. Uitgelicht: 3D-plattegrond met de SVG-animatie. 6. Voor wie (4 groepen). 7. Bibliotheekpreview (live, 6 kaarten). 8. Gratis en betaald. 9. Echte cijfers (live). 10. FAQ (8 vragen, `<details>`). 11. Slot-CTA met dezelfde twee knoppen.

Afwijkingen van het voorstel: "Voor wie" bevat geen voortgezet onderwijs, verenigingen of buitenschoolse opvang (de data en code laten dat niet zien), en er is geen testimonialblok zolang er geen echte zijn.

## Lighthouse (mobiel, lokale productiebuild, Lighthouse 12.6)
| | Performance | FCP | LCP | TBT | CLS | A11y | Best practices | SEO |
|---|---|---|---|---|---|---|---|---|
| Oorspronkelijke landing (vóór de 3D-focus) | 93 | 2,1 s | 2,9 s | 60 ms | 0 | 96 | 100 | 100 |
| Vorige versie (3D-focus) | 98 | 1,2 s | 2,4 s | 30 ms | 0 | 96 | 100 | 100 |
| **Nieuwe pagina** (echte data) | **97–98** | 1,2 s | 2,4–2,5 s | 10–20 ms | 0 | 95 | 96 | 100 |

Beperking: de lokale Next-afbeeldingsoptimalisatie kan Supabase vanuit de sandbox niet bereiken, dus de activiteitafbeeldingen laadden tijdens de meting niet. De LCP kan in productie hoger uitvallen dan hierboven; meet na de deploy opnieuw op https://www.gymwiki.nl. De hero-afbeeldingen zijn klein (compacte kaarten, `sizes`), de eerste twee hebben `priority`, alle media hebben een vaste beeldverhouding (CLS 0).
Best practices zakte van 100 naar 96 door de lokale testopzet (afbeeldingen en http); controleer dat in productie.

## Animatie en reduced-motion
De editor-animatie (SVG + CSS, transform/opacity) staat nu in de uitgelichte sectie, niet meer in de hero. Hij pauzeert buiten beeld (`IntersectionObserver`) en bij een verborgen tabblad. Scroll-reveals duren 500 ms, kaarten hebben een hover-lift, tellers tellen eenmalig op. Met `prefers-reduced-motion: reduce` staan alle animaties uit (gecontroleerd in de Playwright-tests: `animation-name: none`, tellers tonen direct de eindwaarde).

## SEO en meten
- Title (59 tekens): "GymWiki — activiteiten en lesideeën voor bewegingsonderwijs"; description 160 tekens; één H1; H2 per sectie; canonical `https://www.gymwiki.nl`; OG/Twitter; OG-afbeelding via `app/opengraph-image.tsx`.
- JSON-LD in de ruwe HTML: Organization, WebSite, SoftwareApplication (alleen `operatingSystem: "Web"`, prijzen uit de centrale config) en FAQPage (letterlijk de zichtbare FAQ). Gevalideerd met `lib/landing/landing.test.ts` en `node scripts/check-guest-seo.mjs <url>` (ruwe HTML zonder JavaScript, ook sitemap en robots).
- Interne links: bibliotheek (`/activiteiten`), de gratis editorpagina (uitgelichte sectie, functieblok, footer, nav) en Over GymWiki. De editorpagina houdt zijn eigen SEO.
- Analytics: er is geen analytics-systeem, alleen de lokale `gymwiki:event`-hook. Nieuwe events: `landing_cta_primair`, `landing_cta_bibliotheek`, `landing_cta_editor` (met `plek`) en `landing_scrolldiepte` (25/50/75/100 %). Er gaat niets over het netwerk; een provider moet nog worden aangesloten.

## Gevonden en opgelost
- De oude landing las de bibliotheekpreview met de service-role-client, maar `SUPABASE_SERVICE_ROLE_KEY` staat niet in de Vercel-productieomgeving. De preview en het activiteitenaantal waren daardoor in productie waarschijnlijk leeg. De nieuwe pagina gebruikt de publieke view `activiteiten_publiek` en de publieke policy op `material_models` met de anon-client.
- "180+ 3D-modellen" op de vorige versie klopte niet: er zijn 184 actieve, waarvan 6 "personen" verborgen zijn (178 zichtbaar). De nieuwe pagina telt live.
- `operatingSystem: "Web, iOS, Android"` in het schema was niet te verifiëren; nu alleen "Web".

## TODO's en aannames voor de eigenaar
- **Testimonials**: `proof.testimonials` in `content/landing.nl.ts` is leeg; voeg echte quotes toe (met toestemming).
- **Doelgroepen**: voortgezet onderwijs, verenigingen en buitenschoolse opvang zijn niet opgenomen. Voeg ze toe als je ze echt bedient.
- **Privacy**: er is geen privacyverklaring in de app; de FAQ-vraag over privacy beschrijft alleen wat uit de code blijkt. Voeg een link toe zodra die er is.
- **Kerndoelen**: de FAQ zegt eerlijk dat er geen directe koppeling met kerndoelen is.
- **3D bij activiteiten**: er is nu geen enkele activiteit met een gekoppelde 3D-plattegrond (0 van 206 in de database). De hero toont daarom een als "Voorbeeld uit de gratis editor" gelabelde tegel; echte 3D-kaarten verschijnen vanzelf (met badge) zodra er plattegronden aan activiteiten hangen. In de code heet de koppeling nog "3D (beta)".
- **Service-role-sleutel**: `getPublicFloorplanThumbnails` (`lib/services/floorplans3d.ts`) gebruikt nog de service-client en geeft zonder sleutel een lege lijst; ook de Stripe-webhook gebruikt die sleutel. Controleer of die omgevingsvariabele in productie bedoeld ontbreekt.
- Prijzen en aantallen komen uit `lib/constants/subscriptionPlans.ts`; er zijn geen nieuwe bedragen verzonnen.
