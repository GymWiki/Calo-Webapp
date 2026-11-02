# Compliance per richtlijn (stand 2026-11-01)

Apple-regels zijn rechtstreeks gelezen op https://developer.apple.com/app-store/review/guidelines/. Google-regels zijn **niet** rechtstreeks gelezen (support.google.com was vanuit de bouwomgeving niet bereikbaar); de Google-rijen berusten op zoekresultaten en eigen kennis en moeten door jou in Play Console → *Beleid en programma's* worden bevestigd.

| Richtlijn | Voldoet? | Toelichting / wat ontbreekt |
|---|---|---|
| **Apple 4.2** (meer dan een website) | **Deels / risico** | Aanwezig: native deelmenu voor exports, haptiek, offline-scherm met recent bekeken, deep links, app-icoon/splash, safe areas, IAP. Het blijft een app die de live site toont (`server.url`). Aanbevolen vóór indienen: bruikbare testresultaten op echte toestellen + sterke reviewnotities (zie `review-notes.md`). Eventuele uitbreiding: lokale opslag van een bibliotheek-subset, biometrische login. |
| **Apple 3.1.1** (IAP) | Ja | Alle ontgrendeling in de app via store-aankoop; geen Stripe/links/webprijzen in de app; teamaankoop en facturatieportaal verborgen in de app. **Aandachtspunt:** de uitgelogde landingspagina in de app toont de websiteprijzen (incl. lifetime €99) zonder koopknop, alleen "registreren". Laag/middel risico; wil je het zeker weten, verberg het prijsblok in de app. |
| **Apple 3.1.2** (abonnementen) | Ja, mits ingesteld | Duur ≥ 7 dagen (1 maand/1 jaar), beschikbaar op alle apparaten van de gebruiker (account-gekoppeld), proef via introductory offer, paywall toont prijs, periode, automatische verlenging, hoe op te zeggen, links naar voorwaarden en privacy, plus "Aankopen herstellen". Vereist: de producten correct aanmaken (`docs/store-products.md`) en in de app-versie opnemen. |
| **Apple 3.1.1(a)/3.1.3** (andere betaalmethoden/links) | Ja (niet gebruikt) | Geen externe-aankoopentitlement aangevraagd; EU/NL-uitzondering bewust niet gebouwd. |
| **Apple 4.8** (Sign in with Apple) | Niet van toepassing | Alleen eigen e-mail+wachtwoord; geen social login. |
| **Apple 5.1.1** (privacy, login, data) | Ja, na deploy | Privacyverklaring op `/privacy` en link in registreren; publieke bibliotheekpreview en gratis editor zonder account; datagebruik beperkt tot noodzakelijk; **5.1.1(v) account verwijderen** in de app. **Open:** KvK/verantwoordelijke invullen in de privacyverklaring. |
| **Apple 2.1** (volledigheid) | Na jouw acties | Demo-account, werkende backend op de reviewdag, IAP's zichtbaar en gekoppeld, geen placeholder-teksten (bundle ID `com.mycompany.gymwiki` is een **placeholder-achtige naam**: bevestig dat dit je echte ID is). |
| **Google Payments** (Play Billing verplicht voor digitale goederen) | Ja | Aankopen via Play Billing (RevenueCat); geen externe betaalflow in de app. |
| **Google Subscriptions** (transparantie, proef, opzeggen) | Ja, mits ingesteld | Zelfde paywalltekst; base plans + free-trial-offer volgens `store-products.md`. |
| **Google Data safety** | Concept klaar | `privacy-labels.md`; jij vult het formulier in en controleert de onzekerheden. |
| **Google account deletion** | Ja, na deploy | In-app pad + web-URL `https://www.gymwiki.nl/account-verwijderen` (in Play Console invullen). |
| **Google target API** | Waarschijnlijk (target 36) | Controleer in Play Console → Beleidsstatus; niet geverifieerd. |
| **Google testvereiste nieuw persoonlijk account** | Actie nodig | Zie `checklist.md`. |
