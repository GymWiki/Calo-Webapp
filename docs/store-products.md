# Store-producten (Apple + Google)

Prijzen komen in de app **altijd uit de store** (RevenueCat → `priceString`), niet uit de code. Een prijswijziging (bv. naar €3,99 / €34,99) doe je in App Store Connect / Play Console; er is geen codewijziging nodig. De websiteprijs staat apart in Stripe (`STRIPE_PRICE_MONTHLY/YEARLY`) en `lib/constants/subscriptionPlans.ts`.

> Lifetime (€99) en teamabonnementen worden **niet** in de app verkocht (alleen website); bestaande kopers houden toegang.

## Producten

| | Maandelijks | Jaarlijks |
|---|---|---|
| Product-ID (Apple en Google-abonnement) | `gymwiki_monthly` | `gymwiki_yearly` |
| Google base plan-ID | `monthly` | `yearly` |
| Weergavenaam | GymWiki Maandelijks | GymWiki Jaarlijks |
| Prijs (basis) | € 3,00 | € 25,00 |
| Periode | 1 maand, auto-verlengend | 1 jaar, auto-verlengend |
| Proefperiode | 7 dagen gratis, alleen nieuwe abonnees | 7 dagen gratis, alleen nieuwe abonnees |
| RevenueCat entitlement | `pro` | `pro` |
| RevenueCat package | `$rc_monthly` | `$rc_annual` |

De id's staan ook in `lib/subscription/revenuecat.ts` (`PRODUCT_PLAN`). Wijzig je ze, pas dat dan aan.

## App Store Connect

1. **Apps → GymWiki → Monetization → Subscriptions → Create Subscription Group**: naam `GymWiki Pro`.
2. Twee abonnementen in **dezelfde groep**: `gymwiki_monthly` (duur 1 maand) en `gymwiki_yearly` (1 jaar). Rangorde: jaarlijks boven maandelijks (upgrade).
3. Per abonnement: **Subscription Prices** → NL €3,00 / €25,00 (Apple rekent de overige landen om; controleer en pas aan).
4. Per abonnement: **Introductory Offer** → Type *Free*, duur *1 week*, alle landen, "Eligibility: new subscribers" (standaard). Doe dit voor beide producten; één proef per abonnementsgroep is Apple's eigen regel.
5. **Localizations** (NL + EN): weergavenaam en omschrijving, bijvoorbeeld "Volledige toegang tot de GymWiki-bibliotheek, zonder bijdrage-eis."
6. **Review Information**: screenshot van de paywall (zie `docs/release/screenshots.md`) + notitie "Sandbox: test met een sandbox-tester".
7. **Agreements, Tax, and Banking**: Paid Apps Agreement actief, bankrekening, btw-gegevens (zie checklist).
8. Voeg de abonnementen toe aan de app-versie bij indienen (checkbox "In-App Purchases and Subscriptions").
9. **App Store Small Business Program** aanvragen (15%).

## Google Play Console

1. **Monetize → Products → Subscriptions → Create subscription**: Product ID `gymwiki_monthly`, naam "GymWiki Maandelijks"; idem `gymwiki_yearly`.
2. **Base plan** per abonnement: ID `monthly` (billing period *1 month*, auto-renewing) resp. `yearly` (*1 year*); prijs €3,00 / €25,00 (NL); overige landen aanpassen of laten omrekenen.
3. **Offer** op elk base plan: *Free trial*, 7 dagen, eligibility *New customer acquisition* (alleen mensen die dit abonnement nog nooit hadden). Zet de offer op **actief**.
4. Activeer de base plans. De app moet minstens in een interne testtrack staan voordat producten testbaar zijn.
5. **Licentietesters** toevoegen (Setup → License testing) voor sandbox-aankopen.
6. Koppel een **service account** voor RevenueCat (zie `docs/revenuecat-setup.md`).
7. Betalingsprofiel en belastinginformatie invullen (zie checklist).
