# Testplan

## Automatisch (CI)
- `npm run lint`, `npx tsc --noEmit`, `npm test` (incl. `lib/subscription`, `lib/mobile`), `npm run build`, `npm run check:bundle-size`, `npm run test:e2e`.
- Unit tests dekken: toegangslogica (proef, opgezegd, coulance, lifetime), RevenueCat-event-mapping (proefstart, conversie, opzeggen tijdens proef, verlopen), "geen overschrijven van actief Stripe-abonnement", deeplink-vertaling, offline-lijst.

## Simulator/emulator (checklist)
- [ ] Apparaten: iPhone SE-formaat, iPhone Pro Max, iPad; Pixel klein/groot, tablet.
- [ ] Lichte en donkere modus (statusbalk leesbaar, geen witte flits bij start).
- [ ] Staand en liggend (editor bruikbaar, geen afgesneden knoppen, safe areas/notch).
- [ ] **Android edge-to-edge** (target SDK 36): inhoud valt niet onder statusbalk/gebaarnavigatie. Zo wel: `android.adjustMarginsForEdgeToEdge` / SystemBars-instellingen van Capacitor 8 aanpassen (niet geverifieerd in deze omgeving).
- [ ] Inloggen, uitloggen, sessie blijft na herstart van de app.
- [ ] Offline: vliegtuigmodus → offline-scherm, "Opnieuw proberen" werkt, "Recent bekeken" opent een activiteit zodra er weer verbinding is.
- [ ] Deep link: `xcrun simctl openurl booted https://www.gymwiki.nl/zoeken` en `adb shell am start -a android.intent.action.VIEW -d https://www.gymwiki.nl/zoeken`.

## Echt toestel (checklist)
- [ ] WebView-gedrag: scrollen, toetsenbord (invoervelden 16px, geen zoom), terugknop (Android), swipe-back (iOS).
- [ ] **3D-editor**: aanraken (slepen, knijpen, roteren), geen pull-to-refresh tijdens slepen, geen "stotteren"; plaats 30 leerlingen en controleer FPS en geheugen (Xcode Instruments / Android Studio Profiler); app mag niet crashen bij 5 min gebruik.
- [ ] Exporteren: PNG/PDF/JSON openen het deelmenu en komen goed aan (Bestanden, Mail, AirDrop/WhatsApp).
- [ ] Deep links vanuit Mail/Notities openen de app.
- [ ] Account verwijderen op een testaccount; daarna inloggen met dat account lukt niet meer.
- [ ] Camera/foto kiezen bij activiteit toevoegen (toestemmingsmeldingen in het Nederlands).

## Abonnementen (sandbox/testproducten; nooit echt betalen)
Voorwaarde: producten + RevenueCat + webhook-secrets ingesteld (`docs/revenuecat-setup.md`) en `entitlements_multi_source.sql` gedraaid (op een Supabase **test/branch-project**, niet productie).
- [ ] iOS sandbox-tester: aankoop maandelijks → trialing → toegang aan (`subscriptions.status = 'trialing'`, `users.trial_used = true`).
- [ ] Android licentietester: idem; proef alleen voor nieuwe klant.
- [ ] Opzeggen tijdens proef: toegang blijft tot `trial_ends_at`, daarna weg (`EXPIRATION`).
- [ ] Conversie proef → betaald (`RENEWAL`, status `active`).
- [ ] Verlopen/geannuleerd en `BILLING_ISSUE` (coulance 14 dagen).
- [ ] Aankopen herstellen op een nieuw apparaat/ander toestel.
- [ ] Gebruiker met Stripe-abonnement opent de app: paywall verschijnt **niet**; toont "loopt via de website".
- [ ] Gebruiker met store-abonnement op de website: geen Stripe-knoppen; checkout API weigert (400).
- [ ] Gebruiker met afgeronde Stripe-proef start geen tweede proef in de store en omgekeerd (`trial_used`; let op: de store-proef-eligibility regelt Apple/Google zelf per Apple-ID/Google-account, `trial_used` dekt Stripe en de webhook).
- [ ] Webhook opnieuw afspelen (zelfde `event.id`) verandert niets.
- [ ] Geen of ongeldige `Authorization` → 401; sandbox-event in productie → genegeerd.
- [ ] Zonder geldig entitlement geen toegang tot betaalde functies.

> Bekende beperking: de proef-eligibility volgens de store (Apple-ID/Google-account) en `trial_used` (GymWiki-account) zijn twee aparte vangnetten. Iemand met een tweede Apple-ID kan in theorie opnieuw een store-proef krijgen; de store-aanbieding blijft leidend.
