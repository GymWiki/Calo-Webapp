# GymWiki als native app (iOS + Android)

Dit document legt uit hoe de native iOS/Android-app is opgezet, wat er al
werkt, en — belangrijker — precies welke accounts/geheimen JIJ moet
aanleveren voordat een build daadwerkelijk naar TestFlight/App Store Connect
of Google Play geüpload kan worden. Niets hiervan kon door Claude Code zelf
worden aangemaakt (Apple/Google-accounts, betaalde memberships, geheime
sleutels) — alleen geconfigureerd zodra jij het aanlevert.

## Hoe dit werkt (belangrijk om te snappen vóór je verder leest)

De native app is **geen aparte codebase**. Het is een dun [Capacitor](https://capacitorjs.com/)-omhulsel
dat een WebView opent die rechtstreeks **www.gymwiki.nl** laadt (zie
`capacitor.config.ts`'s `server.url`). Dat betekent:

- **Een gewone deploy naar productie (Vercel) komt automatisch ook in de
  native app terecht** — geen nieuwe store-release nodig voor content-,
  bugfix- of featurewijzigingen aan de webapp zelf.
- Een nieuwe store-release is **alleen** nodig bij wijzigingen aan iets
  *natives*: het icoon/splash-screen, een nieuwe/andere Capacitor-plugin, de
  app-naam/bundle ID, of permissies (bijv. camera-toegang).
- Dit gebruikt géén `next export`/statische build — de webapp blijft
  precies zo gehost als nu (Vercel, met Server Components/Server Actions/
  Supabase enz.), de native app is puur een venster ernaartoe.

## Wat er al staat (samenvatting)

| Onderdeel | Status |
|---|---|
| Capacitor core + iOS/Android-projecten | ✅ Aangemaakt (`ios/`, `android/`) |
| App-naam, bundle ID/package name | ✅ "GymWiki", `com.mycompany.gymwiki` (zie ["Bundle ID"](#bundle-idpackage-name-wijzigen) hieronder — dit is wat je zelf hebt aangeleverd als het bestaande ID) |
| App-icoon + splash-screen | ⚠️ **Tijdelijke placeholder** (gegenereerd uit de huisstijlkleuren, geen logo-bestand beschikbaar) — zie ["Icoon vervangen"](#app-icoonsplash-screen-vervangen) |
| Status bar / safe area | ✅ Donkere statusbalk + `viewport-fit=cover` zodat `env(safe-area-inset-*)` werkt |
| Android hardware-terugknop | ✅ Navigeert terug in de WebView i.p.v. de app te sluiten |
| Camera/bestand-uploads | ✅ Werken al zonder wijzigingen (WebView opent native kiezer); een optionele `pickImageNative()`-helper staat klaar voor een directere "Maak foto"-knop, nog niet in een scherm gebruikt |
| Betaalmuur (Store-conform) | ✅ Geen ingebedde Stripe-checkout meer native — systeem-browser-link + terugkeer-deeplink, zie ["Betaalmuur in de native app"](#betaalmuur-in-de-native-app-geen-ingebedde-checkout) |
| Pushmeldingen | 🔲 Scaffold alleen (client-permissie/token-registratie) — vereist nog APNs/FCM-setup + een server-kant, zie [Pushmeldingen](#pushmeldingen-nog-niet-productieklaar) |
| iOS signing | ⚠️ Automatic signing + `fastlane match`-config staat klaar — vereist jouw Apple Developer-account |
| Android signing | ⚠️ Gradle-signingConfig staat klaar — vereist een door jou aangemaakte keystore |
| Fastlane (`fastlane ios/android beta/release`) | ✅ Lanes werken (gevalideerd met `fastlane lanes`), uploaden vereist jouw accounts |
| GitHub Actions (macOS-runner voor iOS, ubuntu voor Android) | ✅ Workflows staan klaar, handmatig te starten |
| **Getest op een echt toestel/simulator/emulator** | ❌ **Niet gedaan** — deze omgeving is Linux-only zonder Xcode/Android SDK/simulator. Zie ["Wat niet getest kon worden"](#wat-niet-getest-kon-worden) |

## Wat je zelf moet aanleveren

Niets hiervan is optioneel als je daadwerkelijk wilt bouwen/uploaden —
Claude Code kan geen van deze accounts voor je aanmaken.

| Wat | Waarvoor | Kosten |
|---|---|---|
| Apple Developer Program-account | Signing + App Store Connect | $99/jaar |
| App Store Connect API-key (key ID, issuer ID, `.p8`-bestand) | Headless uploaden via Fastlane/CI (2FA-veilig, zie hieronder) | Gratis, via je Developer-account |
| Een privé git-repo voor `fastlane match` | Bewaart versleutelde iOS-certificaten/profielen | Gratis (bijv. een leeg privé GitHub-repo) |
| Google Play Console-account | Android-app-listing | $25 eenmalig |
| Google Play service-account + JSON-key | Headless uploaden via Fastlane/CI | Gratis, via Google Cloud Console |
| Een Android keystore (`.keystore`/`.jks`) | Ondertekenen van release-builds | Gratis, zelf te genereren (zie hieronder) |

### App Store Connect API-key aanmaken

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Gebruikers en toegang** → **Sleutels** (tabblad "Integraties").
2. **Genereer API-sleutel** → rol **App Manager** (voldoende voor uploaden, geen "Admin" nodig).
3. Download het `.p8`-bestand **direct** (kan maar één keer) en noteer de **Key ID** en **Issuer ID**.
4. Zet lokaal in je shell (nooit in git):
   ```bash
   export APP_STORE_CONNECT_API_KEY_ID="ABCD123456"
   export APP_STORE_CONNECT_API_ISSUER_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   export APP_STORE_CONNECT_API_KEY_CONTENT="$(base64 -i AuthKey_ABCD123456.p8)"
   ```
   In GitHub Actions: zet deze drie als **Settings → Secrets and variables → Actions → Secrets**
   (`APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_CONTENT`).

### Fastlane match instellen (iOS-certificaten/profielen)

`match` bewaart je certificaten/provisioning-profiles versleuteld in een
**apart, privé git-repo** (nooit dit GymWiki-repo — certificaten horen niet
bij applicatiecode).

1. Maak een leeg privé repo aan, bijv. `gymwiki-ios-certificates`.
2. Lokaal, eenmalig:
   ```bash
   export MATCH_GIT_URL="https://github.com/<jouw-org>/gymwiki-ios-certificates.git"
   export MATCH_PASSWORD="<verzin-een-sterk-wachtwoord-en-bewaar-het-in-een-password-manager>"
   bundle exec fastlane match appstore
   ```
   Dit vraagt om je Apple-inloggegevens (of gebruikt de API-key hierboven als die al gezet is), maakt een distributiecertificaat + App Store-provisioning-profile aan, en zet ze versleuteld in het certificaten-repo.
3. In GitHub Actions: zet `MATCH_GIT_URL` en `MATCH_PASSWORD` als secrets. Als het certificaten-repo niet via SSH-key toegankelijk is voor de runner, zet ook `MATCH_GIT_BASIC_AUTHORIZATION` (een base64-encoded `username:personal-access-token`, zie [match se eigen docs](https://docs.fastlane.tools/actions/match/#git-storage-auth)).

### Android keystore aanmaken

```bash
keytool -genkeypair -v \
  -keystore release.keystore \
  -alias gymwiki \
  -keyalg RSA -keysize 2048 -validity 10000
```

Beantwoord de vragen (naam, organisatie, etc. — mag summier), kies een sterk
wachtwoord voor zowel de keystore als de key. **Bewaar dit bestand + het
wachtwoord ergens veilig buiten git (bijv. een password manager) — als je
'm kwijtraakt, kun je NOOIT MEER een update uploaden voor deze app**, Google
Play accepteert dan alleen nog een build ondertekend met dezelfde key.

Lokaal bouwen:
```bash
cp android/app/keystore.properties.example android/app/keystore.properties
# vul storeFile/storePassword/keyAlias/keyPassword in
cp release.keystore android/app/release.keystore
```

In GitHub Actions: encodeer beide als base64 en zet ze als secrets:
```bash
base64 -i release.keystore | pbcopy   # macOS; gebruik `base64 -w0` op Linux
```
→ zet als `ANDROID_KEYSTORE_BASE64`, plus `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` als losse secrets.

### Google Play service-account aanmaken

1. [Google Play Console](https://play.google.com/console) → **Instellingen** → **API-toegang** → koppel een Google Cloud-project (of maak er een aan).
2. **Nieuwe service-account maken** — dit opent Google Cloud Console; geef de service-account de rol "Service Account User".
3. Terug in Play Console: geef die service-account **toegang** tot je app, met minimaal de rechten "Releases beheren" en "Testen en releasen bekijken".
4. In Cloud Console: maak een **JSON-sleutel** voor die service-account en download 'm.
5. Lokaal: `export GOOGLE_PLAY_JSON_KEY_PATH="/pad/naar/die-key.json"`.
6. In GitHub Actions: `base64 -w0 die-key.json` → zet als secret `GOOGLE_PLAY_JSON_KEY_BASE64`.

## Bundle ID/package name wijzigen

Momenteel overal ingesteld als **`com.mycompany.gymwiki`**. Als dit niet het
ID is dat al in App Store Connect/Google Play Console staat, wijzig het op
**al** deze plekken vóór je een build uploadt (een verkeerd ID maakt een
tweede, aparte listing i.p.v. een update van de bestaande):

1. `capacitor.config.ts` → `appId`
2. `ios/App/App.xcodeproj/project.pbxproj` → beide `PRODUCT_BUNDLE_IDENTIFIER`-regels (via Xcode: project → target "App" → General → Bundle Identifier, makkelijker dan handmatig editen)
3. `ios/App/App/Info.plist` → `CFBundleURLTypes` → `CFBundleURLSchemes` (het custom URL-scheme voor de "Terug naar de app"-deeplink, zie ["Betaalmuur in de native app"](#betaalmuur-in-de-native-app-geen-ingebedde-checkout) hieronder — moet gelijk zijn aan de bundle ID)
4. `android/app/build.gradle` → `namespace` én `applicationId`
5. `android/app/src/main/res/values/strings.xml` → `package_name`/`custom_url_scheme`
6. `components/mobile/ReturnToAppBanner.tsx` → de hardgecodeerde `com.mycompany.gymwiki://`-deeplink-URL
7. Herdraai daarna `npx cap sync`

## App-icoon/splash-screen vervangen

Er stond nergens in de GymWiki-repo een logo-bestand (alleen de tekst
"GYMWIKI" in een display-font) — `scripts/generate-app-icon.mjs` genereert
daarom een tijdelijk, herkenbaar icoon uit de bestaande huisstijlkleuren
(`--ink`/`--cone` uit `app/globals.css`, hetzelfde kegel-beeldidioom als
elders in de app). Zodra er een echt logo is:

1. Vervang de tekenlogica in `scripts/generate-app-icon.mjs` (of schrijf een
   eigen script dat een bestaand logo-bestand inleest en herschaalt).
2. `npm run mobile:icons` — schrijft alle iOS/Android-formaten opnieuw naar
   de exacte paden die de native projecten verwachten.
3. **Let op Apple's alpha-kanaal-eis**: het gegenereerde icoon heeft
   (onvermijdelijk met de gebruikte tekenbibliotheek) een alpha-kanaal, ook
   al is elke pixel ondoorzichtig. App Store Connect wijst een App Store-
   icoon MET alpha-kanaal af bij het uploaden — Xcode meldt dit duidelijk
   bij het archiveren; een simpele "flatten"-actie in een beeldbewerker (of
   een export zonder alpha) lost het op. Controleer dit zodra je een echt
   logo gebruikt.

## Lokaal bouwen/testen

```bash
npm install
npm run mobile:sync        # of: npx cap sync
npm run mobile:ios         # opent het project in Xcode (macOS nodig)
npm run mobile:android     # opent het project in Android Studio
```

Vanuit Xcode/Android Studio: gewoon op ▶ Run klikken naar een Simulator/
Emulator of aangesloten toestel — dat vervangt volledig het handmatig
klikken door de IDE die de brief noemt te willen vermijden vóór een
release-upload, maar voor een snelle lokale testrun tijdens ontwikkeling is
dit nog steeds de normale weg.

## Fastlane: bouwen + uploaden met één commando

```bash
bundle install              # eenmalig, installeert Fastlane (Gemfile.lock is meegecommit)
bundle exec fastlane ios beta        # bouwt + uploadt naar TestFlight
bundle exec fastlane ios release     # bouwt + zet 'm klaar in App Store Connect (concept, zie hieronder)
bundle exec fastlane android beta    # bouwt + uploadt naar Google Play's interne testtrack
bundle exec fastlane android release # bouwt + zet 'm klaar op Google Play productie (concept, zie hieronder)
```

Beide `release`-lanes uploaden bewust **niet automatisch live**:
- iOS: de build staat klaar in App Store Connect, maar "Indienen voor
  review" blijft een handmatige klik (zie ["Nieuwe versie
  indienen"](#nieuwe-versie-indienen-op-een-bestaande-listing)).
- Android: `release_status: "draft"` — de release staat klaar op Play
  Console maar moet je daar zelf naar "Uitrollen" zetten.

Dit is bewust: een laatste menselijke controle vóór iets echt naar
miljoenen gebruikers gaat, hoort niet volledig geautomatiseerd te zijn.

Alle env-vars die de lanes gebruiken staan in `fastlane/Appfile`/
`fastlane/Matchfile` — zie de tabel hierboven voor waar elke waarde vandaan
komt. Zonder een Apple/Google-account gezet, faalt `bundle exec fastlane ios
beta`/`android beta` met een duidelijke foutmelding (fastlane vraagt
interactief om ontbrekende gegevens, of `ensure_android_keystore_present`
in de Fastfile geeft een gerichte foutmelding) — geen cryptische crash.

## GitHub Actions (geen eigen Mac nodig voor iOS)

Twee workflows, beide **handmatig gestart** (Actions-tab → workflow
selecteren → "Run workflow") zodat een build/upload nooit een bijeffect is
van een gewone push:

- **`.github/workflows/mobile-ios.yml`** — draait op een macOS-cloud-runner
  (GitHub host 't, dus geen eigen Mac nodig), voert `fastlane ios <lane>`
  uit.
- **`.github/workflows/mobile-android.yml`** — draait op een gewone
  ubuntu-runner (Android heeft sowieso nooit een Mac nodig).

Beide vereisen dat je de secrets uit de tabel hierboven instelt op
**Settings → Secrets and variables → Actions** van dit repo:

- iOS: `APPLE_DEVELOPER_TEAM_ID`, `APP_STORE_CONNECT_TEAM_ID`,
  `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`,
  `APP_STORE_CONNECT_API_KEY_CONTENT`, `MATCH_GIT_URL`, `MATCH_PASSWORD`
  (+ optioneel `MATCH_GIT_BASIC_AUTHORIZATION`), en de repo-**variabele**
  (niet secret) `IOS_BUNDLE_ID` als die afwijkt van
  `com.mycompany.gymwiki`.
- Android: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`,
  `GOOGLE_PLAY_JSON_KEY_BASE64`, en de repo-variabele
  `ANDROID_PACKAGE_NAME` als die afwijkt.

## Nieuwe versie indienen op een bestaande listing

Zodra er al een listing bestaat in App Store Connect/Google Play Console
met hetzelfde bundle ID/package name:

1. Hoog `CFBundleShortVersionString`/`versionName` en `versionCode` op als
   je zelf een specifiek versienummer wilt communiceren (Fastlane's
   `increment_build_number`/`android_set_version_code` in de Fastfile
   verhogen het **build**-nummer al automatisch bij elke upload — dat is
   iets anders dan het zichtbare **versie**nummer, dat mag je bewust
   handmatig laten staan totdat je 'm zelf wilt wijzigen).
2. `bundle exec fastlane ios beta` / `android beta` eerst — test de build
   via TestFlight/de interne testtrack vóórdat je 'm naar productie stuurt.
3. `bundle exec fastlane ios release` / `android release` — zet de build
   klaar.
4. **Handmatig, in de store-console zelf**: controleer/werk screenshots en
   beschrijvingstekst bij (los van deze technische bouwstap — zie de brief:
   "een handmatige, content-taak"), en klik daadwerkelijk "Indienen voor
   review" (App Store Connect) of "Uitrollen naar productie" (Play
   Console).

## Pushmeldingen (nog niet productieklaar)

`lib/mobile/pushNotifications.ts` regelt alleen het **client**-gedeelte
(toestemming vragen + device-token ophalen) en wordt bewust nergens
automatisch aangeroepen — ongevraagd bij eerste app-start om
pushmeldingen-toestemming vragen is slechte praktijk, en er is nog geen
server-kant om er iets mee te doen. Voor echt gebruik ontbreekt nog:

1. Een APNs-certificaat/key (iOS) en een Firebase Cloud Messaging-project
   (Android) — via Apple Developer resp. [Firebase Console](https://console.firebase.google.com).
2. Een tabel om device-tokens per gebruiker op te slaan (bijv.
   `public.push_tokens`, analoog aan hoe `public.subscriptions` nu
   Stripe-state bijhoudt).
3. Een verzendpad (server action/edge function) die die tokens gebruikt.

Roep `registerForPushNotifications()` pas aan vanuit een expliciete
gebruikersactie (bijv. een toggle in `/profiel/instellingen`) zodra dat
serverwerk er is.

## Betaalmuur in de native app (geen ingebedde checkout)

Apple en Google verbieden een ingebedde betaalervaring voor een digitaal
abonnement binnen de app/WebView — dus toont de native app géén Stripe-
checkout in-app, voor geen van de drie plannen (maandelijks/jaarlijks/
lifetime, zie ["Drie abonnementsopties"](#drie-abonnementsopties-maandelijks-jaarlijks-lifetime)
hieronder). `components/subscription/ProCheckoutButton.tsx` (de enige plek
die daadwerkelijk een Stripe-checkout-sessie aanmaakt) wordt alleen
gerenderd als `components/subscription/SubscriptionPlansSection.tsx` via
`useIsNativeApp()` (`lib/mobile/useIsNativeApp.ts`) vaststelt dat dit géén
native app is; in de native app tonen de drie prijskaarten alleen
vergelijkingsinformatie (prijs/besparing), zonder losse koop-knop per
kaart, en staat er in plaats daarvan ÉÉN gedeelde
`components/mobile/NativeUpgradeAction.tsx` eronder: een knop "Abonnement
afsluiten op gymwiki.nl" met een neutrale toelichting, die de systeem-
browser opent (`Browser.open()` van `@capacitor/browser`, dus
SFSafariViewController/Chrome Custom Tabs — zie de code-comments in
`lib/mobile/capacitor.ts`'s `openInSystemBrowser()` voor een belangrijke
nuance hieronder) naar `/pro?native=1` — dezelfde, ongewijzigde webpagina
die gewone browserbezoekers ook zien, inclusief de bestaande ingebedde
Stripe-checkout (voor alle drie plannen), die daar wél is toegestaan (dat
is een gewone webbrowser, geen app-WebView).

**Alle overige upgrade-CTA's in de app** (`components/library-access-blocked.tsx`,
`components/profile/FreemiumStatusCard.tsx`,
`app/(protected)/zoeken/library-search-client.tsx`) linken alleen naar
`/pro` — ze roepen Stripe nooit rechtstreeks aan, dus die hoefden niet
aangepast: zodra `/pro` zelf platform-bewust is, is de hele app dat. De
eerder geplande "Genereer een activiteit op maat met AI"-upsell bestaat
niet meer in de codebase (de AI-generator is in een eerdere taak volledig
verwijderd) — niets om daar aan te passen.

**Terugkeer naar de app na betaling**: `?native=1` wordt doorgegeven aan
`POST /api/stripe/create-checkout` (zie `app/api/stripe/create-checkout/route.ts`)
en landt in Stripe's `success_url`/`cancel_url` als `&native=1`. Op
`/pro?checkout=success&native=1` toont `components/mobile/ReturnToAppBanner.tsx`
een "Terug naar de app"-link naar het custom URL-scheme
`com.mycompany.gymwiki://` (geregistreerd in `ios/App/App/Info.plist` en
`android/app/src/main/AndroidManifest.xml` — zie ["Bundle ID wijzigen"](#bundle-idpackage-name-wijzigen)
als je die ooit aanpast). Tikken op die link haalt de OS de app naar de
voorgrond en triggert `lib/mobile/capacitor.ts`'s `appUrlOpen`-listener, die
een **volledige** reload naar `/pro` doet — geen aparte syncstap nodig,
want dat plukt de bijgewerkte abonnementsstatus (door de bestaande Stripe-
webhook → Supabase, ongewijzigd) meteen op.

**Nuance om te checken vóór je indient**: `@capacitor/browser`'s `Browser.open()`
opent op iOS/Android altijd een **in-app** SFSafariViewController/Chrome
Custom Tab — de plugin's eigen types (`node_modules/@capacitor/browser/.../definitions.d.ts`)
bevestigen dat de `windowName`-optie ("systeembrowser forceren") alleen op
web werkt en op native platforms genegeerd wordt. Dit is het gangbare,
door Apple algemeen geaccepteerde patroon voor "beheer je abonnement op
onze website"-links bij reader-apps (Kindle, Netflix, Spotify gebruiken
precies dit), en is functioneel duidelijk "verlaat de app" voor de
gebruiker (eigen adresbalk, eigen cookie-jar/sessie — een gebruiker moet
daar dus opnieuw inloggen, dat is verwacht gedrag). Het is **niet**
hetzelfde als een letterlijke overstap naar de losse Safari/Chrome-app
(dat vereist Apple's aparte, opt-in "External Purchase Link Entitlement" met
strengere technische eisen). Controleer of GymWiki's daadwerkelijke
App Store-beoordelingscategorie (reader-app-uitzondering vs. die aparte
entitlement) hiermee overeenkomt vóór je indient — dit kon niet in deze
sandbox worden geverifieerd.

## Wat niet getest kon worden

Deze hele setup is gebouwd in een Linux-only cloud-omgeving zonder Xcode,
Android SDK, simulator of fysiek toestel. Concreet **niet** geverifieerd:

- Dat de app daadwerkelijk opstart en de live webapp toont op een echt
  toestel/simulator/emulator.
- De hele betaalmuur-flow op een echt toestel: dat "Abonnement afsluiten op
  gymwiki.nl" daadwerkelijk de systeem-browser opent (niet de WebView), dat
  de "Terug naar de app"-deeplink (`com.mycompany.gymwiki://`) de app
  daadwerkelijk naar de voorgrond haalt op zowel iOS als Android, en dat de
  bijgewerkte abonnementsstatus na een echte testbetaling zichtbaar is bij
  terugkeer. Alleen `tsc`/`eslint`/`next build`/bundle-size-check zijn
  gedraaid (allemaal groen) — dit is codecorrectheid, geen functionele
  test.
- Dat inloggen, de canvas-editor (pinch-to-zoom/rotate/move — de code
  gebruikt de standaard Pointer Events-API met `preventDefault()`, wat
  zowel in iOS' WKWebView als Android's WebView breed ondersteund wordt,
  maar dat is een code-review, geen praktijktest), bestandsuploads en
  overige kernfunctionaliteit correct werken binnen de native WebView.
- Hoe het icoon/splash-screen er op een echt scherm uitziet (alleen als
  losse PNG's bekeken, zie de paden in `ios/App/App/Assets.xcassets/` en
  `android/app/src/main/res/mipmap-*/`).
- Dat de Fastlane-lanes daadwerkelijk succesvol bouwen/uploaden — alleen
  gevalideerd dat `fastlane lanes` de Fastfile foutloos inleest (Ruby-
  syntax + dat alle gebruikte fastlane-acties bestaan), niet dat een echte
  `fastlane ios beta` slaagt (dat vereist Xcode + een geldig Apple-account).

**Eerstvolgende, concrete stap voor jou**: lever de accounts/geheimen uit de
tabel hierboven aan, draai lokaal (of via de GitHub Actions-workflows)
`fastlane ios beta`/`fastlane android beta`, en installeer de resulterende
TestFlight-/interne-testtrack-build op een echt toestel om alles hierboven
alsnog te verifiëren vóórdat je naar productie uploadt.
