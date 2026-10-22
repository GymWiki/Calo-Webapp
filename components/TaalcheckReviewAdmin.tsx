"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Languages, X } from "lucide-react";
import { toast } from "sonner";

import {
  applyApprovedTaalcheckVoorstellen,
  approveTaalcheckVoorstel,
  rejectTaalcheckVoorstel,
} from "@/actions/adminTaalcheck";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import type { TaalcheckVoorstelWithActivity } from "@/types/taalcheck";

function VoorstelCard({ voorstel }: { voorstel: TaalcheckVoorstelWithActivity }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resolved, setResolved] = useState<"approved" | "rejected" | null>(null);

  function handleApprove() {
    startTransition(async () => {
      const result = await approveTaalcheckVoorstel(voorstel.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setResolved("approved");
      router.refresh();
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectTaalcheckVoorstel(voorstel.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setResolved("rejected");
      router.refresh();
    });
  }

  return (
    <Card className={resolved ? "opacity-60" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href={`/activiteit/${voorstel.activiteit_id}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              {voorstel.activiteit_titel}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">
              Veld: <code className="font-mono">{voorstel.veldnaam}</code>
            </p>
          </div>
          {resolved ? (
            <Badge variant={resolved === "approved" ? "success" : "secondary"}>
              {resolved === "approved" ? "Goedgekeurd" : "Afgewezen"}
            </Badge>
          ) : (
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={handleReject}
              >
                <X className="size-4" />
                Afwijzen
              </Button>
              <Button type="button" size="sm" disabled={isPending} onClick={handleApprove}>
                <Check className="size-4" />
                Goedkeuren
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
              Origineel
            </p>
            <p className="text-sm whitespace-pre-line">{voorstel.originele_tekst}</p>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
              Voorgesteld
            </p>
            <p className="text-sm whitespace-pre-line">{voorstel.voorgestelde_tekst}</p>
          </div>
        </div>
        {voorstel.reden_van_wijziging && (
          <p className="text-xs text-muted-foreground italic">
            Reden: {voorstel.reden_van_wijziging}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function TaalcheckReviewAdmin({
  voorstellen,
}: {
  voorstellen: TaalcheckVoorstelWithActivity[];
}) {
  const router = useRouter();
  const [isApplying, startApplying] = useTransition();

  function handleApplyAll() {
    startApplying(async () => {
      const result = await applyApprovedTaalcheckVoorstellen();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.appliedCount === 0) {
        toast.info("Geen goedgekeurde voorstellen om toe te passen.");
      } else {
        toast.success(
          `${result.appliedCount} wijziging${result.appliedCount === 1 ? "" : "en"} toegepast op de live activiteiten.`,
        );
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Goedkeuren schrijft nog niets weg — pas met &ldquo;Toepassen&rdquo; hieronder worden
          alle op dit moment goedgekeurde voorstellen naar de live activiteiten geschreven.
        </p>
        <Button type="button" variant="outline" disabled={isApplying} onClick={handleApplyAll}>
          {isApplying ? "Bezig..." : "Goedgekeurde wijzigingen toepassen"}
        </Button>
      </div>

      {voorstellen.length === 0 ? (
        <EmptyState
          icon={Languages}
          title="Geen openstaande voorstellen"
          description="Er zijn momenteel geen taalcheck-voorstellen die op beoordeling wachten."
        />
      ) : (
        <div className="space-y-4">
          {voorstellen.map((voorstel) => (
            <VoorstelCard key={voorstel.id} voorstel={voorstel} />
          ))}
        </div>
      )}
    </div>
  );
}
