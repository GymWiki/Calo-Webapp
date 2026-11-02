# Stripe-webhook

## Endpoint
| | |
|---|---|
| **URL (live én test)** | `https://www.gymwiki.nl/api/stripe/webhook` |
| Methode | `POST` (Stripe). `GET` op hetzelfde pad is een healthcheck en geeft `200 {"ok":true,…}` |
| Code | `app/api/stripe/webhook/route.ts` (verwerking in `lib/stripe/webhook.ts`) |
| Runtime | Node.js (`export const runtime = "nodejs"`), `maxDuration = 30`, `force-dynamic` |
| Pad-constante | `lib/stripe/webhook-path.ts` (`STRIPE_WEBHOOK_PATH`) — een test faalt als code, proxy, rewrites of deze doc uit de pas lopen |

Regels voor de URL in Stripe:
- Altijd **`www.`** gebruiken. `https://gymwiki.nl/…` stuurt Vercel met een 308 door; Stripe volgt geen redirects en markeert dat als mislukt.
- **Geen slash** aan het einde (`…/webhook/` geeft een 308).
- Live en test gebruiken **hetzelfde pad**, maar elk endpoint heeft een **eigen signing secret**.
- Tolerantie voor een afwijkend pad: deze paden worden transparant (rewrite, geen redirect) naar het echte pad herschreven: `/api/webhooks/stripe`, `/api/stripe/webhooks`, `/api/stripe-webhook`, `/api/webhook/stripe`. Gebruik ze niet bewust; zet het echte pad in Stripe.
- `proxy.ts` (auth/sessie) slaat dit pad en de aliassen over; er is geen auth, i18n of CORS-laag.

## Vereiste events (vink exact deze aan)
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`
- `invoice.paid`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Andere events worden met 200 genegeerd. Antwoorden: `400` ongeldige/ontbrekende handtekening (Stripe probeert niet opnieuw), `500` configuratie ontbreekt of verwerking mislukt (Stripe probeert opnieuw), `200` verwerkt, genegeerd of duplicaat.

## Geheimen (alleen namen; waarden nooit in git of chat)
| Variabele | Waar | Doel |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` | Vercel Production (en Preview voor test) | Signing secret `whsec_…` van **dit** endpoint (live ≠ test) |
| `STRIPE_SECRET_KEY` | Vercel | Subscription ophalen bij Stripe (`sk_live_…` / `sk_test_…`, passend bij de modus) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (Sensitive) | Wegschrijven van toegang; zonder deze key kan de webhook niets opslaan |
| `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_PRICE_LIFETIME` | Vercel | Plan-herkenning (terugval op `metadata`/interval) |
| `STRIPE_PAST_DUE_GRACE_DAYS` | Vercel (optioneel) | Coulance bij mislukte betaling, standaard 3 |

## Controleren
1. `curl -s https://www.gymwiki.nl/api/stripe/webhook` → `{"ok":true,…}` (na deploy van deze fix; vóór de fix: `405`).
2. Stripe → Webhooks → endpoint → **Send test webhook** → 2xx.
3. `/beheer/betalingen` (admin) toont de configuratie en mislukte events.
