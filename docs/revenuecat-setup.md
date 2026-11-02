# RevenueCat instellen

RevenueCat regelt de aankoop-/herstelflow voor Apple en Google en stuurt webhooks naar GymWiki. Het is de gekozen laag (geen eigen receipt-validatie). Kosten: gratis onder de omzetdrempel van RevenueCat (controleer hun actuele prijzen vóór je groeit); er is nog geen account aangemaakt.

## 1. Account en project
1. Account op revenuecat.com → project **GymWiki**.
2. Voeg twee apps toe: **App Store** (bundle ID = `appId` uit `capacitor.config.ts`) en **Play Store** (package name idem).
3. iOS: maak in App Store Connect een **In-App Purchase Key** (Users and Access → Integrations → In-App Purchase) en upload die in RevenueCat; vul ook de **App Store Connect API key** in zodat prijzen en eligibility kloppen.
4. Android: maak in Google Cloud een **service account**, geef het in Play Console (Users and permissions) rechten *View financial data* en *Manage orders and subscriptions*, upload de JSON-sleutel in RevenueCat. (Het kan tot ~36 uur duren voordat Google dit accepteert.)

## 2. Producten, entitlement, offering
- Importeer `gymwiki_monthly` en `gymwiki_yearly` (zie `docs/store-products.md`).
- **Entitlement** `pro`: koppel beide producten.
- **Offering** `default` (markeer als *current*) met packages `$rc_monthly` → `gymwiki_monthly` en `$rc_annual` → `gymwiki_yearly`.

## 3. API-sleutels (secrets)
| Naam | Waar | Waarde |
|---|---|---|
| `NEXT_PUBLIC_REVENUECAT_IOS_KEY` | Vercel env (Production + Preview) | publieke SDK-sleutel iOS (`appl_…`) |
| `NEXT_PUBLIC_REVENUECAT_ANDROID_KEY` | Vercel env | publieke SDK-sleutel Android (`goog_…`) |
| `REVENUECAT_WEBHOOK_AUTH` | Vercel env (alleen server) | zelfgekozen lang willekeurig geheim, bv. `openssl rand -hex 32` |
| `REVENUECAT_ACCEPT_SANDBOX` | Vercel env **Preview only** | `true` om sandbox-aankopen op een testomgeving te verwerken; laat leeg in Production |

De publieke SDK-sleutels zijn bedoeld voor in de app; de **secret** API-sleutel van RevenueCat gebruiken we niet. Zet niets hiervan in de repo.

## 4. Webhook
RevenueCat → Integrations → Webhooks:
- URL: `https://www.gymwiki.nl/api/revenuecat/webhook`
- **Authorization header value**: exact de waarde van `REVENUECAT_WEBHOOK_AUTH`.
- Omgeving: Production **en** Sandbox (sandbox-events worden in productie genegeerd tenzij `REVENUECAT_ACCEPT_SANDBOX=true`).
- Eventnamen die de route verwerkt: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `UNCANCELLATION`, `BILLING_ISSUE`, `EXPIRATION`, `PRODUCT_CHANGE`. Andere events worden stil genegeerd (200).

Idempotentie: elk `event.id` wordt in `billing_events` vastgelegd; een herhaald event doet niets. Bij een schrijffout geeft de route 500 en verwijdert de vastlegging, zodat RevenueCat opnieuw probeert.

## 5. Koppeling met GymWiki-accounts
De app roept `Purchases.configure({ appUserID: <supabase user id> })` / `logIn` aan voordat het aanbod wordt getoond (`lib/mobile/purchases.ts`). De webhook negeert events waarvan `app_user_id` geen UUID is (anonieme gebruikers). Zo is er één account per gebruiker over web en apps.

## 6. Testen (sandbox)
Zie `docs/release/testing.md` → "Abonnementen".
