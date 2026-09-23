import { ArrowLeftCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * Getoond op /pro wanneer die pagina via de systeem-browser-link vanuit de
 * native app is geopend (?native=1, zie components/mobile/NativeUpgradeAction.tsx)
 * én Stripe net is teruggekomen van de checkout (?checkout=success/cancelled,
 * zie app/api/stripe/create-checkout/route.ts). Puur een server-gerenderde
 * link naar het custom_url_scheme (com.mycompany.gymwiki://, geregistreerd
 * in ios/App/App/Info.plist + android/.../AndroidManifest.xml) — geen
 * JS nodig, tikken op een link met dit schema haalt de OS de native app al
 * naar de voorgrond en triggert lib/mobile/capacitor.ts's appUrlOpen-
 * listener, die de WebView vers laadt zodat de bijgewerkte
 * abonnementsstatus (via de Stripe-webhook) meteen zichtbaar is.
 */
export function ReturnToAppBanner({ status }: { status: "success" | "cancelled" }) {
  return (
    <Card className={status === "success" ? "border-success/40 bg-success/5" : undefined}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
        <p className="text-sm text-muted-foreground">
          {status === "success"
            ? "Je abonnement is afgerond."
            : "Je hebt de betaling niet afgerond."}
        </p>
        <a
          href="com.mycompany.gymwiki://checkout-terugkeer"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeftCircle className="size-4" />
          Terug naar de app
        </a>
      </CardContent>
    </Card>
  );
}
