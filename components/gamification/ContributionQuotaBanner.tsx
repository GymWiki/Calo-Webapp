import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContributionStatus } from "@/lib/gamification";

/**
 * Waarschuwing (geen blokkade — zie brief) voor gratis gebruikers die het
 * contributiequotum van hun huidige level nog niet gehaald hebben binnen de
 * lopende periode. Rendert niets voor Pro-gebruikers, level 10 (geen
 * quotum) of wanneer het quotum al gehaald is.
 */
export function ContributionQuotaBanner({
  status,
}: {
  status: ContributionStatus;
}) {
  if (!status.required || status.met || !status.quota) {
    return null;
  }

  const remaining = status.quota.amount - status.count;
  const periodLabel =
    status.quota.periodMonths === 1
      ? "deze maand"
      : `binnen deze ${status.quota.periodMonths}-maandse periode`;

  return (
    <Card className="animate-fade-up border-amber-300 bg-amber-50">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <TriangleAlert className="size-4.5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Nog {remaining} {remaining === 1 ? "les" : "lessen"} nodig {periodLabel}
            </p>
            <p className="mt-0.5 text-xs text-amber-800">
              Gratis accounts blijven actief door periodiek een
              lesvoorbereiding te maken — of upgrade naar Pro om dit over te
              slaan.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild size="sm">
            <Link href="/les-maken">Les maken</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/pro">Upgrade naar Pro</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
