# Stripe-betalingen zonder pro-status: oorzaak en herstel

Peildatum 2026-11-02. Onderzoek is alleen-lezen uitgevoerd; er is niets geschreven in productie en niets gewijzigd in Stripe.

## 0. Bijgewerkte conclusie (2 nov, na de 404-melding uit Stripe)
- **Oorzaak A (zeker aan jouw kant):** het live-endpoint in Stripe wijst naar een pad dat in de app niet bestaat (Next.js-404). Het **echte** pad is `https://www.gymwiki.nl/api/stripe/webhook`. Bewijs: `GET` daarop geeft live **405** (route bestaat, alleen POST); gangbare varianten (`/api/webhooks/stripe`, `/api/stripe/webhooks`, `/api/webhook`, `/api/stripe-webhook`, `/stripe/webhook`) geven live allemaal **404**. De route zit in de productiedeploy `a12a6fb` (en al sinds `0412683`, 2026-09-08, nooit verplaatst of hernoemd; `git log --diff-filter=D` toont geen verwijderde webhook-route). Welk pad er precies in Stripe staat kan ik niet zien; vergelijk het met het pad hierboven.
- **Oorzaak B (verborgen achter A):** `SUPABASE_SERVICE_ROLE_KEY` ontbreekt in Vercel Production. Zodra het pad klopt zou de oude webhook alsnog 500'en. Zonder deze key blijft herstel dus zinloos: zet hem vóór je opnieuw verstuurt.
- De fix voegt toe: een GET-healthcheck, transparante rewrites voor afwijkende paden (geen redirect), uitsluiting van het pad in `proxy.ts`, en tests die falen als pad, docs, proxy of rewrites uit de pas lopen. Zie `docs/stripe-webhook.md`.

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

## 4. Stappenplan voor jou (in deze volgorde)

**Back-up vóór stap 6.** Supabase Dashboard → Database → Backups: controleer dat er een recente dagelijkse back-up is (en maak anders een eigen). Maak daarnaast een dump van de tabellen die het herstel raakt:
`pg_dump "$SUPABASE_DB_URL" --data-only --table=public.users --table=public.subscriptions --table=public.teams -Fc -f gymwiki-voor-herstel-$(date +%F).dump`
Terugzetten kan per tabel met `pg_restore`. Het herstel is idempotent (opnieuw draaien geeft hetzelfde resultaat).

1. **Fix deployen.**
   - Vercel → Settings → Environment Variables → Production: voeg `SUPABASE_SERVICE_ROLE_KEY` toe (Supabase → Project Settings → API → `service_role`, Sensitive). Controleer ook `STRIPE_SECRET_KEY` (live) en `STRIPE_WEBHOOK_SECRET`.
   - PR → merge → wacht tot de Vercel-productiedeploy `READY` is. (Deze branch bevat ook de app-release-commits; wil je alleen de hotfix, cherry-pick `lib/stripe/*`, `app/api/stripe/*`, `app/api/subscription/*`, `next.config.ts`, `proxy.ts`, de succespagina- en sync-componenten.)
   - Test: `curl -s https://www.gymwiki.nl/api/stripe/webhook` → `{"ok":true,"endpoint":"stripe-webhook","methods":["POST"]}`. Open daarna `/beheer/betalingen`: alle configuratieregels groen.
   - Optioneel nu al: migratie `supabase/migrations/stripe_events.sql` (event-log; idempotent). De webhook werkt ook zonder.
2. **Pad en secret controleren in Stripe** (Developers → Webhooks, **Live** én daarna **Test**):
   - Endpoint-URL is exact `https://www.gymwiki.nl/api/stripe/webhook` (met `www`, https, zonder slash aan het einde). Past het niet: bewerk de URL.
   - Events: precies de lijst uit `docs/stripe-webhook.md` (9 stuks, zie onderaan deze doc).
   - **Signing secret** (Reveal) van dít endpoint = `STRIPE_WEBHOOK_SECRET` in Vercel (live ≠ test). Is het verschillend: zet de juiste in Vercel en redeploy.
3. **"Send test webhook"** (kies bijvoorbeeld `customer.subscription.updated`): je moet **2xx** zien (200). Een 400 = verkeerde secret; 500 = configuratie ontbreekt (kijk in Vercel Logs / `/beheer/betalingen`); 404 = het pad klopt nog niet.
4. **Mislukte events opnieuw versturen**: bij het endpoint → *Events* (filter *Failed*) → per event **Resend** (Stripe bewaart events ± 30 dagen). Controleer dat ze nu 2xx geven.
5. **Audit draaien (alleen lezen)**:
   - Stripe: Developers → API keys → *Create restricted key*, alleen **Read** op Customers, Subscriptions, Invoices, Checkout Sessions (rest *None*). In `.env.local`: `STRIPE_READONLY_KEY=rk_live_…`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (nooit committen of delen).
   - `npm run audit:betalingen` → `data/audit-betalingen.csv` en `data/audit-handmatig.csv` (persoonsgegevens; lokaal houden). De audit leest de **Stripe-waarheid** (alle actieve, trialing en recent betaalde abonnementen + betaalde lifetime), dus het maakt niet uit of een event nog opnieuw wordt verstuurd.
6. **Herstelscript**:
   - Eerst droog: `npm run repair:entitlements` (schrijft niets; toont per gebruiker wat zou veranderen; maakt `data/repair-entitlements.sql` en `data/repair-handmatig.csv`). Controleer de lijst.
   - Daarna pas live, **na de back-up**: `npm run repair:entitlements -- --apply --i-have-a-backup`
   - Of liever zelf in SQL: plak `data/repair-entitlements.sql` in de Supabase SQL-editor (één transactie, idempotent).
   - Klanten die alleen op e-mailadres gekoppeld zijn: eerst controleren, dan `--include-email-matches`. Klanten zonder koppeling (ander e-mailadres): zie `data/repair-handmatig.csv` met voorstel; koppel die handmatig.
7. **Controleren**: `npm run audit:betalingen` opnieuw → "betaald maar geen pro" = 0 en elke getroffen klant staat op `ok`. Check `/beheer/betalingen` (geen mislukte events, geen "actief maar niet pro"). Vraag één getroffen klant (of test met je eigen account) of de pro-functies zichtbaar zijn; anders kunnen ze op Profiel → Instellingen op "Abonnement synchroniseren" klikken.

### Events die in het Stripe-endpoint aangevinkt moeten staan
`checkout.session.completed` · `checkout.session.async_payment_succeeded` · `customer.subscription.created` · `customer.subscription.updated` · `customer.subscription.deleted` · `customer.subscription.trial_will_end` · `invoice.paid` · `invoice.payment_succeeded` · `invoice.payment_failed`

### Conceptbericht voor getroffen klanten (pas aan en verstuur zelf)
> **Onderwerp:** Je GymWiki-abonnement is geactiveerd
>
> Hallo [voornaam],
>
> Je hebt een GymWiki-abonnement afgesloten, maar door een technische fout werd je account niet meteen op volledige toegang gezet. Dat is nu hersteld: je hebt volledige toegang tot de bibliotheek en alle functies. Je hoeft niets te doen en er is niets dubbel afgeschreven.
>
> Zie je het toch nog niet? Ga in GymWiki naar Profiel → Instellingen en kies "Abonnement synchroniseren", of mail ons op info@gymwiki.nl.
>
> Onze excuses voor het ongemak, en bedankt voor je steun.
>
> Groet,
> [naam], GymWiki

Pas de tekst aan als iemand zijn proefperiode of betaaldatum wil laten verrekenen; dat is een beslissing van jou (en gaat via Stripe), niet van het script.

## 5. Openstaande punten
- Aantallen getroffen klanten per categorie heb ik niet kunnen bepalen: daarvoor is een Stripe-key nodig die in deze omgeving ontbreekt. In Supabase staan 8 gebruikers: 3 pro (1 `monthly`, 2 `none`), 5 `free_blocked`, en 0 abonnementsrijen. Draai de audit voor de echte aantallen.
- Welk pad er in Stripe staat is niet door mij te zien; de 404 bevestigt dat het afwijkt van `/api/stripe/webhook`. Als het een van de aliassen is (`/api/webhooks/stripe`, `/api/stripe/webhooks`, `/api/stripe-webhook`, `/api/webhook/stripe`) werkt het na deploy meteen; zet het echte pad er toch in.
- De 2 gebruikers met `paid_subscriber/none` hebben geen Stripe-koppeling en komen in de audit als "pro zonder Stripe-abonnement" terug: bepaal of dat bewust is.
- Zelfherstel op e-mail vereist een bevestigd e-mailadres; als "Confirm email" in Supabase uitstaat (zie `register`-actie) werkt die terugval niet en verloopt koppelen via metadata/klant-ID of handmatig.
- Rate limiting van het zelfherstel is in-memory per serverinstantie (goedkoop, niet strikt); bij veel gebruikers eventueel naar een tabel verplaatsen.
