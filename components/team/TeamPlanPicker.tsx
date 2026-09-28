"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlanCard } from "@/components/subscription/PlanCard";
import {
  TEAM_CONTACT_EMAIL,
  TEAM_PLAN_ORDER,
  TEAM_PLANS,
  type TeamPlan,
} from "@/lib/constants/subscriptionPlans";
import { cn } from "@/lib/utils";

/**
 * Geen-team-state: pakketkeuze + teamnaam + factuurgegevens + "Team
 * aanmaken" — maakt de subscription rechtstreeks aan (facturering op
 * factuur, zie app/api/stripe/create-team/route.ts — GEEN Checkout-
 * redirect: die ondersteunt collection_method 'send_invoice' niet). 40+
 * seats is bewust geen zelfbediening (zie de brief), dus geen vierde
 * koopbare kaart maar een losse contact-CTA.
 */
export function TeamPlanPicker() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<TeamPlan>("team_m");
  const [teamName, setTeamName] = useState("");
  const [invoiceName, setInvoiceName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleCreate() {
    if (teamName.trim().length < 2) {
      toast.error("Vul een teamnaam in (minstens 2 tekens).");
      return;
    }
    if (invoiceName.trim().length < 2) {
      toast.error("Vul een factuurnaam in (school/sectie).");
      return;
    }
    setIsPending(true);
    try {
      const response = await fetch("/api/stripe/create-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan, teamName, invoiceName, vatNumber }),
      });
      const result = await response.json();
      if (!response.ok || "error" in result) {
        toast.error(result.error ?? "Team aanmaken is mislukt. Probeer het opnieuw.");
        return;
      }
      toast.success("Team aangemaakt — je kunt nu collega's uitnodigen.");
      router.refresh();
    } catch {
      toast.error("Team aanmaken is mislukt. Controleer je verbinding.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {TEAM_PLAN_ORDER.map((planId) => {
          const plan = TEAM_PLANS[planId];
          return (
            <button
              key={planId}
              type="button"
              onClick={() => setSelectedPlan(planId)}
              className={cn("text-left rounded-xl outline-none", selectedPlan === planId && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-xl")}
            >
              <PlanCard
                plan={plan}
                action={
                  <div
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-md border py-2 text-sm font-medium",
                      selectedPlan === planId
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-muted-foreground",
                    )}
                  >
                    {selectedPlan === planId ? "Geselecteerd" : "Selecteer"}
                  </div>
                }
              />
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="team-name">Teamnaam</Label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Bijv. Vaksectie LO — De Vlinder"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invoice-name">Factuurnaam (school/sectie)</Label>
            <Input
              id="invoice-name"
              value={invoiceName}
              onChange={(event) => setInvoiceName(event.target.value)}
              placeholder="Bijv. Stichting Onderwijs De Vlinder"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vat-number">Btw-nummer (optioneel)</Label>
            <Input
              id="vat-number"
              value={vatNumber}
              onChange={(event) => setVatNumber(event.target.value)}
              placeholder="NL000000000B00"
            />
          </div>
          <Button type="button" className="w-full" disabled={isPending} onClick={handleCreate}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isPending ? "Bezig..." : `Team aanmaken — ${TEAM_PLANS[selectedPlan].label}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Je ontvangt jaarlijks een factuur op deze naam, te voldoen binnen 30 dagen. Je team is meteen
            actief — je kunt direct collega&apos;s uitnodigen.
          </p>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-sm font-medium">Meer dan 40 collega&apos;s?</p>
            <p className="text-sm text-muted-foreground">
              Voor een hele school of scholengroep maken we graag een offerte op maat.
            </p>
          </div>
          <Button asChild variant="outline">
            <a href={`mailto:${TEAM_CONTACT_EMAIL}?subject=${encodeURIComponent("Teamabonnement GymWiki — offerte")}`}>
              <Mail className="size-4" />
              Neem contact op
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
