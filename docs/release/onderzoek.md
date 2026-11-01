# App-uitbrengen: onderzoek (stap 1)

Peildatum: 2026-11-01. Er is in dit onderzoek niets gewijzigd, ingediend of uitgevoerd tegen productie.

## 1. Bevindingen in de code

| Onderwerp | Bevinding |
|---|---|
| Framework | Next.js 16 (App Router), Supabase (Auth + Postgres + Storage), Vercel. |
| Inloggen | Alleen e-mail + wachtwoord (`app/(auth)/actions.ts`: `signInWithPassword`, `signUp`, `resetPasswordForEmail`). **Geen OAuth/social login** → "Inloggen met Apple" (guideline 4.8) is niet verplicht. Geen magic link. Sessies via Supabase-cookies (`utils/supabase/*`, `proxy.ts`). |
| Abonnementen | Stripe op de website: maandelijks €3, jaarlijks €25, lifetime €99 (eenmalig), team S/M/L (factuur). Tabel `subscriptions` + `users.subscription_status/type`. Webhook `app/api/stripe/webhook`. Checkout heeft nog **geen** proefperiode. |
| Wat het abonnement ontgrendelt | Volledige bibliotheek (`free_blocked` ziet slechts `LIBRARY_PREVIEW_LIMIT` kaarten) en AI Lescoach. Gratis blijft mogelijk via 3 goedgekeurde bijdragen per maand. |
| 3D-editor | WebGL (three.js), code-split via `Floorplan3dEditorLoader`. |
| Uploads | Supabase Storage (activiteitfoto's, kennisbank, plattegronden, importkaart). Camera/Filesystem-plugins al aanwezig. |
| Push / e-mail | `@capacitor/push-notifications` geïnstalleerd, geen server-kant; e-mail via Supabase Auth. |
| Account verwijderen | **Bestaat niet.** Verplicht voor Apple (5.1.1(v)) en Google. |
| Privacyverklaring | **Geen privacypagina gevonden in `app/`.** Verplicht voor beide stores. |
| Bundle ID / package | `com.mycompany.gymwiki` (capacitor.config.ts, Info.plist, build.gradle). Dit lijkt een placeholder. **Bevestig dat dit overeenkomt met de listings in App Store Connect/Play Console**; de ID is na eerste upload niet meer te wijzigen. |
| Bestaande native opzet | Capacitor 8, `server.url = https://www.gymwiki.nl`, `ios/`, `android/`, Fastlane, workflows. Het bestaande betaalmuur-pad (systeembrowser naar `/pro?native=1`) is **in strijd met 3.1.1** voor de NL-storefront en wordt vervangen. |
| Android | minSdk 24, compile/target 36, alleen `INTERNET`-permissie. |

## 2. Winkelregels (bronnen)

**Apple — direct gelezen op https://developer.apple.com/app-store/review/guidelines/ (2026-11-01):**
- 4.2: app moet "beyond a repackaged website" gaan; anders afgewezen. → native meerwaarde nodig.
- 3.1.1: functies/abonnementen ontgrendelen moet via in-app purchase. 3.1.1(a)/3.1.3: buiten de VS geen knoppen, links of calls-to-action naar andere betaalmethoden, tenzij met een StoreKit External Purchase Link Entitlement. → **Geen Stripe-link in de app. Geen vermelding van goedkopere webprijzen.**
- 3.1.2(a): abonnement minimaal 7 dagen, beschikbaar op alle apparaten van de gebruiker; gratis proef via App Store Connect-aanbod.
- 4.8: alleen verplicht bij social login; GymWiki heeft dat niet.
- 5.1.1(v): bij accountaanmaak moet account verwijderen **in de app** startbaar zijn. Apple-hulppagina: https://developer.apple.com/support/offering-account-deletion-in-your-app
- 2.1: demo-account in review notes, backend aan; IAP's moeten zichtbaar en werkend zijn.

**Google Play — alleen via zoekresultaten (support.google.com was niet bereikbaar uit deze sessie; controleer zelf):**
- Accountverwijdering: als de app accountaanmaak biedt, is een in-app pad én een web-link voor verwijderverzoeken verplicht, plus Data safety-vragen. Bron: https://support.google.com/googleplay/android-developer/answer/13327111
- Nieuwe persoonlijke ontwikkelaarsaccounts (na 13 nov 2023): closed test met minimaal 12 testers, 14 aaneengesloten dagen, vóór aanvraag productietoegang. Organisatieaccounts zijn vrijgesteld. Bron: https://support.google.com/googleplay/android-developer/answer/14151465
- Target-API-eis en Payments/Subscriptions-beleid: **niet geverifieerd**; controleer in Play Console → Beleidsstatus.

**Apple EU/NL externe betaallinks:** de EU-voorwaarden (DMA) staan externe links toe onder een entitlement met commissies (bronnen wisselen in bedragen: MacRumors 2025-06-26 https://www.macrumors.com/2025/06/26/app-store-eu-rule-change-dma). Ik bouw dit **niet** in; dat vereist jouw expliciete akkoord, een aparte Apple-addendum en een fee-afweging.

**RevenueCat (zoekresultaat, docs niet bereikbaar):** introductory-eligibility is best-effort, werkt niet via de hybride SDK op Android en geeft in sandbox vaak "unknown". Consequentie: de paywall toont "7 dagen gratis" alleen bij `eligible` (iOS); op Android baseren we de tekst op de offer-informatie van het geboden product (`introPrice`/`freePhase`) en de betaalsheet van Google toont de echte voorwaarden.

## 3. Risico's en maatregelen

| Risico | Maatregel |
|---|---|
| 4.2 afwijzing (website-wrapper) | Native deel: share sheet voor export, haptics, offline cache, deep links, splash/icoon, safe areas, optioneel biometrie. Review notes leggen 3D-editor uit. |
| `server.url` live site | Voordeel: webupdates zonder winkelrelease. Nadeel: offline/4.2. Keuze: **live url behouden + native offline-fallbackpagina en cache van recente activiteiten**; zie plan. |
| WebGL in WKWebView/Android WebView | Bestaande mobiele editor-optimalisaties (docs/mobile-performance.md); native test op echte toestellen in checklist; `touch-action: none` op canvas, geen pull-to-refresh. |
| Dubbele betaling Stripe + store | Eén entitlement-bron; UI toont "loopt via website / store" en blokkeert tweede aankoop. |
| Dubbele proefperiode | `trial_used` gedeeld over alle bronnen. |
| Lifetime (€99) en team-abonnementen | **Niet in je opdracht.** Voorstel: in de app alleen maandelijks/jaarlijks tonen; lifetime/team bestaan alleen op de website en worden in de app als bestaande toegang gelezen (geen aankooplink in de app). Lifetime-gebruikers hebben dus altijd toegang. |
| Gratis bijdrage-tier | Blijft werken; de paywall in de app verschijnt alleen waar nu al de upgrade-uitnodiging staat. Geen verplichte login voor publieke bibliotheek en gratis editor. |
| Ontbrekende privacypagina / account verwijderen | Bouwen in dit traject (stap 2/4). |
| Google 12-testers-regel | Planning in `docs/release/checklist.md`; organisatieaccount (D-U-N-S) overwegen. |

## 4. Plan

1. Onderzoek (dit document).
2. Capacitor-setup en scripts, native functies.
3. Account verwijderen (app + web) + migratie (niet uitgevoerd).
4. Entitlements-migratie + gedeelde logica + unit tests.
5. RevenueCat, paywall, restore, webhook, trial in Stripe-checkout.
6. Store-materiaal, privacy, compliance-checklists.
7. CI-lanes en uitrolchecklist.
