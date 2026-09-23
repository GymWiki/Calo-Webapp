import Link from "next/link";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ContributionStatus } from "@/lib/services/contribution";

/**
 * Blocking-scherm dat de volledige activiteit-inhoud vervangt voor een
 * free_blocked-gebruiker die geen eigen bijdrage is (zie
 * app/(protected)/activiteit/[id]/page.tsx) — géén gedeeltelijke inhoud
 * tonen en dan pas blokkeren, dit IS de hele pagina-inhoud. Toont expliciet
 * de voortgang richting de gratis-eis (dezelfde ContributionStatus-data en
 * voortgangsbalk-stijl als components/profile/FreemiumStatusCard.tsx) plus
 * twee gelijkwaardige, even prominente acties — geen primaire/secundaire
 * hiërarchie, want beide routes (bijdragen of betalen) zijn voor GymWiki
 * even wenselijk.
 */
export function LibraryAccessBlocked({ status }: { status: ContributionStatus }) {
  const percent = Math.min(
    100,
    Math.round((status.approvedCount / status.requiredCount) * 100),
  );

  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <Lock className="size-6" aria-hidden="true" />
      </div>

      <div className="space-y-1.5">
        <p className="text-lg font-semibold">Bibliotheektoegang beperkt</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Je hebt deze maand nog geen activiteiten bijgedragen aan de bibliotheek, dus is deze
          activiteit voor jou vergrendeld. Draag {status.requiredCount} activiteiten bij, of neem
          het betaalde abonnement, voor volledige toegang.
        </p>
      </div>

      <div className="w-full max-w-xs space-y-2">
        <p className="text-sm font-medium">
          {status.approvedCount} van {status.requiredCount} activiteiten deze maand toegevoegd
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300 ease-brand"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2 sm:flex-row">
        <Button asChild className="flex-1">
          <Link href="/les-maken">Activiteit toevoegen</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href="/pro">Bekijk het abonnement</Link>
        </Button>
      </div>
    </div>
  );
}
