"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { deleteAccount } from "@/actions/account";
import { DELETE_ACCOUNT_CONFIRMATION } from "@/lib/constants/account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MANAGE_URLS, type ManageTarget } from "@/lib/subscription/entitlement";

/** Profiel → Instellingen: account definitief verwijderen (verplicht voor App Store en Google Play). */
export function DeleteAccountCard({ manage }: { manage: ManageTarget }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const storeUrl = manage === "app-store" || manage === "google-play" ? MANAGE_URLS[manage] : null;

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount(text);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.replace("/?account=verwijderd");
      router.refresh();
    });
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base">Account verwijderen</CardTitle>
        <CardDescription>
          Verwijdert je account en persoonlijke gegevens definitief. Activiteiten die je met de bibliotheek hebt gedeeld
          blijven anoniem beschikbaar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" className="w-full text-destructive sm:w-auto">
              <Trash2 className="size-4" /> Account verwijderen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Weet je het zeker?</DialogTitle>
              <DialogDescription>Dit kan niet ongedaan worden gemaakt.</DialogDescription>
            </DialogHeader>
            {manage === "stripe-portal" && (
              <p className="text-sm text-muted-foreground">Je abonnement via de website wordt direct opgezegd.</p>
            )}
            {storeUrl && (
              <p className="text-sm text-muted-foreground">
                Let op: je abonnement loopt via {manage === "app-store" ? "de App Store" : "Google Play"} en wordt
                <strong> niet</strong> automatisch opgezegd. Zeg het eerst op via{" "}
                <a href={storeUrl} className="font-medium text-primary underline" target="_blank" rel="noreferrer">
                  Abonnementen beheren
                </a>
                , anders blijft er betaald worden.
              </p>
            )}
            <label className="space-y-2 text-sm">
              <span>
                Typ <strong>{DELETE_ACCOUNT_CONFIRMATION}</strong> om te bevestigen
              </span>
              <Input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="characters" className="text-base" />
            </label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
              <Button type="button" variant="destructive" disabled={pending || text.trim().toUpperCase() !== DELETE_ACCOUNT_CONFIRMATION} onClick={confirm}>
                {pending && <Loader2 className="size-4 animate-spin" />} Definitief verwijderen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
