# Uitrolplan: wat jij doet, in volgorde

Niets hiervan is door mij uitgevoerd: er is niets ingediend, geen store- of betalingsinstelling gewijzigd en geen productiedatabase aangeraakt.

## 0. Eerst bevestigen
- [ ] **Bundle ID / package name**: nu `com.mycompany.gymwiki` (`capacitor.config.ts`, `Info.plist`, `build.gradle`, `strings.xml`). Komt dit overeen met de bestaande listings? Zo niet: volg "Bundle ID wijzigen" in `docs/mobile-app/README.md`. Na de eerste upload is dit niet meer te wijzigen.
- [ ] Privacyverklaring (`app/privacy/page.tsx`): verantwoordelijke + KvK + adres invullen; juridisch laten nalopen. Idem `app/voorwaarden/page.tsx`.

## 1. Accounts en afspraken (jij)
**Apple**
- [ ] Apple Developer Program (€99/jaar) actief; Team ID noteren.
- [ ] App Store Connect → *Business*: **Paid Apps Agreement** accepteren, bankrekening, belastingformulieren (NL btw-nummer).
- [ ] **App Store Small Business Program** aanvragen (15% i.p.v. 30%).
- [ ] Abonnementen + introductory offers aanmaken: `docs/store-products.md`.
- [ ] App Privacy invullen: `docs/release/privacy-labels.md`.
**Google**
- [ ] Play Console → betalingsprofiel (merchant), belastingen, bankrekening.
- [ ] Abonnementen, base plans, free-trial-offers: `docs/store-products.md`.
- [ ] Data safety + account-verwijderings-URL: `docs/release/privacy-labels.md`.
- [ ] **Nieuw persoonlijk account?** Dan moet je eerst een **closed test met minimaal 12 testers, 14 aaneengesloten dagen** draaien voordat je productie mag aanvragen (bron: Google Play Help "Test your app requirements for new personal developer accounts", via zoekresultaten bevestigd; controleer actueel). Plan: werf 15–20 testers (collega-docenten/studenten, mail het opt-in-linkje), houd ze 14 dagen ingeschreven, vraag feedback. Een **organisatieaccount** (D-U-N-S) is vrijgesteld maar vraagt een aanvraagtijd.
**RevenueCat** — `docs/revenuecat-setup.md`.
**Stripe** — zet in het Stripe-dashboard geen aparte proefperiode op de prijzen; de proef komt uit de checkout (`trial_period_days: 7`, alleen als `trial_used = false`).
**Btw/KOR met je boekhouder:** abonnementsomzet via Apple/Google (zij zijn "deemed supplier"/commissionair: bespreek de btw-behandeling), Stripe-omzet op de website; KOR-regeling en OSS bij EU-consumenten.

## 2. Database (productie) — in deze volgorde
1. **Backup**: Supabase Dashboard → Database → Backups → controleer dat de laatste dagelijkse back-up recent is, en maak vooraf een eigen dump:
   `pg_dump "$SUPABASE_DB_URL" --schema=public -Fc -f gymwiki-backup-$(date +%F).dump`
2. `supabase/migrations/account_deletion.sql` (zet FK's naar `ON DELETE SET NULL` voor `activiteiten.author_id` en `beoordeeld_door`). Controleer daarna de query onderaan dat bestand: er mogen geen blokkerende foreign keys naar `public.users` overblijven (`NO ACTION/RESTRICT`).
3. `supabase/migrations/entitlements_multi_source.sql` (nieuwe kolommen op `subscriptions`, `users.trial_used`, tabel `billing_events`, status `trialing`).
Uitvoeren: Supabase SQL-editor (plak het bestand) of
`psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<bestand>.sql`.
Beide zijn idempotent. Test ze eerst op een **Supabase-branch** of testproject. De huidige code werkt ook vóór de migraties (best-effort); proef, store-abonnementen en "account verwijderen" werken pas erna volledig.

## 3. Configuratie (Vercel, secrets nooit in de repo)
| Variabele | Waar vandaan |
|---|---|
| `NEXT_PUBLIC_REVENUECAT_IOS_KEY`, `NEXT_PUBLIC_REVENUECAT_ANDROID_KEY` | RevenueCat → API keys (public) |
| `REVENUECAT_WEBHOOK_AUTH` | zelf genereren (`openssl rand -hex 32`) en in RevenueCat plakken |
| `APPLE_TEAM_ID`, `APPLE_BUNDLE_ID` | Apple Developer → Membership; bundle ID |
| `ANDROID_SHA256_FINGERPRINTS` (komma-gescheiden), `ANDROID_PACKAGE_NAME` | Play Console → App-integriteit → App signing (SHA-256 van het app-signing-certificaat) |
| bestaand: `STRIPE_*`, `SUPABASE_SERVICE_ROLE_KEY` | ongewijzigd |
Controleer na deploy: `https://www.gymwiki.nl/.well-known/apple-app-site-association` en `/.well-known/assetlinks.json` geven JSON (geen 404).

## 4. Deploy van de webapp
PR → merge → Vercel-productie (zoals altijd). Deze release bevat privacy/voorwaarden/account-verwijderen-pagina's, de RevenueCat-webhook en de proef in Stripe-checkout.

## 5. GitHub-secrets voor de build-lanes (Settings → Secrets → Actions)
**iOS** (`.github/workflows/mobile-ios.yml`): `APPLE_DEVELOPER_TEAM_ID`, `APP_STORE_CONNECT_TEAM_ID`, `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_CONTENT` (base64 van de `.p8`), `MATCH_GIT_URL`, `MATCH_PASSWORD`, `MATCH_GIT_BASIC_AUTHORIZATION`. Certificaten/profielen maak je met `fastlane match appstore` (privé repo, versleuteld); **niets in deze repo**. Details: `docs/mobile-app/README.md`.
**Android** (`mobile-android.yml`): `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `GOOGLE_PLAY_JSON_KEY_BASE64`. Maak een **upload-keystore** zelf (`keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`), bewaar die buiten de repo (wachtwoordmanager + back-up!) en zet **Play App Signing** aan (Google beheert de echte signeersleutel).
Lanes starten handmatig: Actions → *Mobile - iOS build & upload* / *Android* → `beta` (TestFlight / interne testtrack). Releases (`release`) pas na goedkeuring in de tests.

## 6. Teststappen
1. **Intern**: TestFlight *internal* (tot 100 testers, geen review) en Play *internal testing*. Doorloop `docs/release/testing.md`.
2. **Extern**: TestFlight *external* (korte Apple-betareview) en Play *closed testing* (12 testers/14 dagen indien persoonlijk account).
3. Pas als alles groen is: indienen.

## 7. Indienen
- Review-notities + demo-account: `docs/release/review-notes.md`. Koppel de abonnementen aan de versie.
- Verwachte doorlooptijd (indicatief, geen garantie): Apple meestal 24–48 uur; Google enkele uren tot enkele dagen (eerste keer langer).
- Veelvoorkomende afwijzingen en voorkoming: **4.2** (website-wrapper) → reviewnotities + native functies tonen; **ontbrekende abonnementsinformatie** → paywalltekst + links aanwezig; **geen Restore** → knop aanwezig; **geen account verwijderen** → aanwezig; **crash** → test op echt toestel; **2.1** (demo-account werkt niet / IAP niet zichtbaar) → check de dag zelf.

## 8. Uitrol en monitoring
- **Google:** gefaseerd (bv. 10% → 50% → 100%) via Production → Release → *Staged rollout*.
- **Apple:** *Phased Release for Automatic Updates* aanzetten (7 dagen).
- **Monitoring:** Play Console Android vitals en Xcode Organizer crash-rapporten (gratis, geen extra SDK). Een crash-SDK (Sentry/Crashlytics) is bewust nog niet toegevoegd: het zou privacylabels, Data safety en de privacyverklaring wijzigen. Beslis dat later. Lees store-reviews wekelijks. Controleer `billing_events` en Vercel-logs van `/api/revenuecat/webhook` na de eerste aankopen.
- **Versiebeleid:** `MARKETING_VERSION`/`versionName` volgt semver (1.0.0 → 1.0.1 fixes, 1.1.0 functies); bouwnummer/`versionCode` stijgt bij elke upload (iOS: Fastlane doet dit; Android: `versionCode` in `android/app/build.gradle` handmatig of via CI ophogen).
- **Webupdates zonder winkelupdate:** de app laadt gymwiki.nl live, dus elke webdeploy bereikt app-gebruikers direct. Een winkelrelease is alleen nodig voor: nieuwe plugins/permissies, wijziging aan `capacitor.config.ts`, icoon/splash, of de offline-schil (`www/`). Let op Apple 4.7/2.5.2: pas geen kernfunctionaliteit aan op een manier die de goedgekeurde app wezenlijk verandert zonder review.

## 9. Open punten / beslissingen voor jou
1. Bundle ID bevestigen (zie 0).
2. **Lifetime (€99) en teams**: niet in de app te koop (alleen website). Akkoord? Alternatief is lifetime als store-product (non-consumable).
3. Websiteprijzen op de uitgelogde landingspagina zichtbaar in de app: laten staan of in de app verbergen (zie `compliance.md`).
4. Externe aankooplink voor EU/NL (Apple entitlement): bewust niet gebouwd; alleen op jouw expliciete akkoord.
5. Biometrische login en uitgebreidere offline-inhoud zijn niet gebouwd (bewust, zie risico 4.2 in `onderzoek.md`).
