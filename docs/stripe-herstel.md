# Stripe-betalingen zonder pro-status: oorzaak en herstel

Peildatum 2026-11-02. Onderzoek is alleen-lezen uitgevoerd; er is niets geschreven in productie en niets gewijzigd in Stripe.

## 1. Oorzaak en bewijs

| # | Bevinding | Bewijs |
|---|---|---|
| 1 | **`SUPABASE_SERVICE_ROLE_KEY` staat niet in Vercel (Production).** Zonder die key gooit `createServiceClient()` een exception (`utils/supabase/service.ts:9-14`); in de oude webhook gebeurde dat direct na de handtekeningcontrole (`route.ts:48`) → 500, er werd niets weggeschreven. | Vercel-project `calo-webapp`, Production-envs: aanwezig `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY/YEARLY/LIFETIME`, `NEXT_PUBLIC_SUPABASE_*`, `OPENAI_*`, `YOUTUBE_*`; **niet** `SUPABASE_SERVICE_ROLE_KEY` (`hiddenProductionEnvCount: 0`). Let op: een gedeelde team-variabele zou hier niet zichtbaar zijn; controleer in het dashboard. |
| 2 | **De tabel `subscriptions` in productie is leeg** (0 rijen), terwijl er 1 gebruiker `paid_subscriber/monthly` is en 2 `paid_subscriber/none` (legacy of handmatig). Er is dus nooit een succesvolle webhook-verwerking geweest. Het schema is correct (unieke index op `user_id`, checks laten monthly/yearly/lifetime toe), dus de upsert faalt niet door het schema. | Supabase `execute_sql` (alleen SELECT) op project `dxdopwhxteodgeaebfpp`. |
| 3 | **Mogelijk: het webhook-endpoint in Stripe staat op de apex `gymwiki.nl`.** Die stuurt een 308 door naar `www.gymwiki.nl`; Stripe volgt geen redirects, elke aanroep faalt dan. | Vercel-domeinen: `gymwiki.nl` → 308 → `www.gymwiki.nl`. Wat er in Stripe staat kan ik niet zien: **controleer dit** (zie §3). Geen runtime-errors in 7 dagen gelogd, wat past bij "er komt niets binnen". |
| 4 | Zwakke code (nu opgelost): schrijffouten werden niet gecontroleerd (`webhook/route.ts:92-110, 187-199` → 200 bij falen), `customer.subscription.updated` voor een onbekende subscription deed niets, `invoice.*` alleen voor teams, `trialing`/`past_due` niet apart behandeld, geen event-log, succespagina wachtte niet op activering. | Code-review van de oude route. |

Niet de oorzaak (gecontroleerd): handtekeningcontrole gebruikt de ruwe body (`request.text()`); proxy (`proxy.ts`) laat `/api/stripe/webhook` door (geen auth-gate); schema/RLS blokkeert de service role niet; price-ID-mapping speelt geen rol (plan komt uit `metadata.subscription_type`). Niet bevestigd: Deployment Protection en `STRIPE_WEBHOOK_SECRET` live-vs-test (controleer in §3); Vercel Hobby bewaart maar 1 uur aan logs, dus de oude betalingsmomenten zijn niet meer terug te lezen.

## 2. Wat er is veranderd (kort)
- `app/api/stripe/webhook/route.ts` + `lib/stripe/*`: nodejs-runtime, `maxDuration 30`, ruwe body, duidelijke 500 bij ontbrekende config, alle events (`checkout.session.completed/async_payment_succeeded`, `customer.subscription.created/updated/deleted/trial_will_end`, `invoice.paid/payment_succeeded/payment_failed`), de **subscription is de bron van waarheid**, `trialing`/`active` = pro, `past_due` = pro tijdens korte coulance (`STRIPE_PAST_DUE_GRACE_DAYS`, standaard 3), schrijffouten → 500 → Stripe probeert opnieuw, event-log in `stripe_events`.
- Koppeling: `metadata.userId`/`client_reference_id` → `stripe_customer_id` → (alleen in scripts of bij bevestigd e-mailadres) e-mail; elke terugval wordt gelogd. Checkout hergebruikt de bestaande Stripe-klant; gast-checkout bestaat niet (de checkout-route eist een ingelogd account).
- Succespagina `/pro?checkout=success&session_id=…`: verifieert de sessie server-side en activeert idempotent, pollt daarna kort; bij vertraging een melding met "Opnieuw proberen" en supportlink.
- Zelfherstel: bij inloggen (op de achtergrond), bij openen van `/pro` en Profiel → Instellingen (eenmaal per sessie), en de knop "Abonnement synchroniseren". Rate-limited (30 s per gebruiker per serverinstantie).
- `/beheer/betalingen`: configuratiecheck (alleen aanwezig/afwezig), mislukte/niet-koppelbare events, actieve abonnementen zonder pro, pro zonder abonnementsrij.
- Scripts: `npm run audit:betalingen`, `npm run repair:entitlements` (standaard droog).
- RevenueCat-webhook: zelfde valkuilen verholpen (ontbrekende service-key → 500, schrijffout op `users` → 500 + retry).

## 3. Controleer in het Stripe-dashboard (jij)
1. **Developers → Webhooks**: het **live**-endpoint moet exact `https://www.gymwiki.nl/api/stripe/webhook` zijn (met `www`, https, geen apex, geen trailing redirect). Staat er `gymwiki.nl` of een oude preview-URL: maak/pas het endpoint aan.
2. **Events** op dat endpoint: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.paid`, `invoice.payment_failed` (en `invoice.payment_succeeded` mag blijven).
3. **Signing secret** van dát endpoint (`whsec_…`) moet gelijk zijn aan `STRIPE_WEBHOOK_SECRET` in Vercel Production. Test- en live-secrets verschillen en elk endpoint heeft een eigen secret.
4. **Recent deliveries / Failed**: bekijk of er 4xx/5xx of "redirect"-fouten staan rond de betaaltijdstippen. Dit is het directe bewijs voor oorzaak 1 of 3.
5. Staat de dashboard-modus op **Live** (niet Test) en horen `STRIPE_SECRET_KEY` en de `STRIPE_PRICE_*` in Vercel bij live?
6. Vercel → Settings → **Deployment Protection**: Production mag niet achter Vercel Authentication staan voor `/api/stripe/webhook` (standaard zijn productiedomeinen vrij; bevestig).

## 4. Productiestappen, in deze volgorde
1. **Back-up** (voor alles): Supabase Dashboard → Database → Backups (controleer recentheid) en eigen dump van de relevante tabellen:
   `pg_dump "$SUPABASE_DB_URL" --data-only --table=public.users --table=public.subscriptions --table=public.teams -Fc -f gymwiki-vóór-herstel-$(date +%F).dump`
2. **Vercel**: voeg `SUPABASE_SERVICE_ROLE_KEY` toe aan **Production** (Supabase → Project Settings → API → `service_role`, markeer als Sensitive). Optioneel `STRIPE_PAST_DUE_GRACE_DAYS`. Controleer het Stripe-endpoint (§3).
3. **Deploy** deze branch (PR → merge → Vercel). Let op: de branch bevat ook de eerdere app-release-commits (privacy, paywall e.d.); wil je alleen de hotfix, cherry-pick de commits "Stripe: …", "Succespagina…", "Beheer: /beheer/betalingen…" en het bijbehorende `lib/stripe/`.
4. Open **`/beheer/betalingen`**: alle configuratieregels moeten groen zijn.
5. **Migratie** `supabase/migrations/stripe_events.sql` (event-log + e-mailopzoek-functie; idempotent): Supabase SQL-editor, of `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/stripe_events.sql`. De webhook werkt ook zonder deze tabel. (De migratie `entitlements_multi_source.sql` uit het app-release-traject is los en optioneel; de code werkt met en zonder.)
6. **Gemiste events opnieuw laten afspelen**: Stripe → Webhooks → je endpoint → mislukte events → **Resend** (Stripe bewaart events ~30 dagen). Dat herstelt de meeste klanten zonder iets anders.
7. **Audit (alleen lezen)**: maak een **restricted key** in Stripe (Developers → API keys → Create restricted key) met uitsluitend **Read** op: Customers, Subscriptions, Invoices, Checkout Sessions (optioneel Prices); alle andere rechten *None*. Zet in `.env.local` (nooit committen of delen): `STRIPE_READONLY_KEY=rk_live_…`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Draai: `npm run audit:betalingen` → `data/audit-betalingen.csv` en `data/audit-handmatig.csv`.
8. **Herstel droog**: `npm run repair:entitlements` (schrijft niets; toont per gebruiker wat er zou veranderen; schrijft `data/repair-entitlements.sql` en `data/repair-handmatig.csv`).
9. **Herstel toepassen** (kies één):
   - Script: `npm run repair:entitlements -- --apply --i-have-a-backup`
   - Of SQL: plak `data/repair-entitlements.sql` in de Supabase SQL-editor (draait in één transactie, idempotent).
   Klanten die alleen op e-mailadres gekoppeld zijn worden niet automatisch hersteld (voeg `--include-email-matches` toe na handmatige controle). Klanten zonder koppeling staan met een voorstel in `data/repair-handmatig.csv`; koppel die handmatig (gebruiker laten inloggen en op "Abonnement synchroniseren" klikken lukt alleen als hun e-mailadres overeenkomt, anders via support).
10. **Controle**: `npm run audit:betalingen` opnieuw → "betaald maar geen pro" moet 0 zijn; `/beheer/betalingen` toont geen afwijkingen.

## 5. Openstaande punten
- Aantallen getroffen klanten per categorie heb ik niet kunnen bepalen: daarvoor is een Stripe-key nodig die in deze omgeving ontbreekt. In Supabase staan 8 gebruikers: 3 pro (1 `monthly`, 2 `none`), 5 `free_blocked`, en 0 abonnementsrijen. Draai de audit voor de echte aantallen.
- Het is nog onbekend of oorzaak 3 (apex-endpoint) of alleen oorzaak 1 speelt; Stripe's "Recent deliveries" geeft zekerheid.
- De 2 gebruikers met `paid_subscriber/none` hebben geen Stripe-koppeling en komen in de audit als "pro zonder Stripe-abonnement" terug: bepaal of dat bewust is.
- Zelfherstel op e-mail vereist een bevestigd e-mailadres; als "Confirm email" in Supabase uitstaat (zie `register`-actie) werkt die terugval niet en verloopt koppelen via metadata/klant-ID of handmatig.
- Rate limiting van het zelfherstel is in-memory per serverinstantie (goedkoop, niet strikt); bij veel gebruikers eventueel naar een tabel verplaatsen.
