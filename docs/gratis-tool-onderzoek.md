# Gratis 3D-plattegrondtool zonder account — onderzoek (stap 1)

## Wat vereist nu een account?
| Onderdeel | Nu | Gevolg voor gasten |
| --- | --- | --- |
| Route `/plattegrond-3d` | page.tsx doet `redirect("/login")` zonder profiel | gast kan niets openen |
| Itemdefinities | `material_models` (RLS: alleen `authenticated`) | anon-select geeft 0 rijen |
| GLB's / omgevingen / previews | publieke bucket `materials-3d` (+ `floorplan-previews`) | al anoniem leesbaar (CDN) |
| Opslaan / lijst / hernoemen / verwijderen / preview | server actions op `floorplans_3d` (RLS eigenaar) | moet in gastmodus nooit aangeroepen worden |
| Lokale kladversie | `localStorage` `gymwiki.floorplan3d.draft.nieuw` (+ herstel-toast) | bestaat al, wordt het gast-opslagmechanisme |
| Mobiele layout, undo/redo, veld afzetten, rotatie | puur client-side | werkt zonder aanpassing |

`proxy.ts` beschermt `/plattegrond-3d` niet zelf (alleen de pagina). Landingspagina is ISR (`revalidate = 3600`) met een
middleware-redirect voor ingelogden. Er is **geen analytics-systeem** (geen Vercel Analytics/Plausible/PostHog/cookiebanner) en geen
privacyverklaring-pagina; animaties zijn `tw-animate-css` + eigen CSS-keyframes (geen Framer Motion).

## Besluiten
- **Itemdata voor gasten:** geen RLS-wijziging en dus geen productiemigratie. De publieke pagina haalt de catalogus server-side op
  met de service-client (kolom-allowlist: naam, afmetingen, URL's), gecached (`revalidate`), en geeft hem als props mee. Er komt
  geen nieuw publiek data-endpoint, dus niets om te rate-limiten behalve de pagina zelf (CDN). GLB's komen uit de publieke bucket.
- **Opslag zonder account:** dezelfde `draft.nieuw`-sleutel als ingelogde gebruikers → na registreren/inloggen biedt de editor
  de plattegrond automatisch aan ("Herstellen"), en het dashboard toont een herinnering. Geen schrijfacties naar Supabase.
- **Delen:** compressed JSON in de URL-**hash** (`#p=…`): wordt niet naar de server gestuurd, geeft geen duplicate content en
  heeft geen server-opslag nodig. Te lang (> 8.000 tekens) → melding en terugval op PNG/PDF.
- **Editor-embedding:** de editor is een app-scherm van 100 dvh; op de SEO-pagina staat een poster met vaste verhouding (geen CLS),
  "Start gratis" opent de editor schermvullend (lazy `import()`), met Sluiten/Esc terug naar de tekstpagina.

## URL-structuur
| URL | Doel |
| --- | --- |
| `/gratis-gymzaal-plattegrond-maken` | hoofdpagina (H1, tekst, FAQ, JSON-LD, editor) |
| `/gymzaal-indeling-maken`, `/opstelling-bewegingsonderwijs-tekenen`, `/veld-afzetten-met-pionnen`, `/volleybalveld-indeling-gymzaal` | long-tail, elk met eigen tekst, voorbeeld en FAQ |
| `/plattegrond-3d` | blijft de ingelogde editor; anoniem **zonder** `?activiteit`/`?open` → redirect naar de gratis tool, anders `/login` |

Plat (geen `/gratis/…`-map) omdat de zoektermen zelf de URL zijn; alles onder één prefix zou de H1/URL-match verwateren.
