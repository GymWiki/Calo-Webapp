"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { leaveTeam } from "@/actions/team";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Team } from "@/types/team";

const STATUS_LABELS: Record<Team["status"], { label: string; variant: "success" | "destructive" | "secondary" }> = {
  active: { label: "Actief", variant: "success" },
  past_due: { label: "Betaling verwerken", variant: "destructive" },
  canceled: { label: "Opgezegd", variant: "secondary" },
};

export function TeamMemberView({ team, ownerName }: { team: Team; ownerName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const statusInfo = STATUS_LABELS[team.status];

  function handleLeave() {
    startTransition(async () => {
      const result = await leaveTeam();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Je hebt het team verlaten.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="size-5" />
            </span>
            <div>
              <p className="font-semibold">{team.name}</p>
              <p className="text-sm text-muted-foreground">Beheerd door {ownerName}</p>
            </div>
          </div>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          Je hebt via dit team volledige toegang tot GymWiki — inclusief de AI Lescoach — zonder zelf
          te betalen of maandelijks activiteiten te hoeven delen.
        </p>

        {!showConfirm ? (
          <Button type="button" variant="outline" onClick={() => setShowConfirm(true)}>
            Team verlaten
          </Button>
        ) : (
          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm">
              Weet je zeker dat je &quot;{team.name}&quot; wilt verlaten? Je valt terug op je eigen gratis-via-
              bijdrage-status — je eigen activiteiten en opgeslagen items blijven behouden. Activiteiten en
              tags die je in de teambibliotheek hebt aangemaakt, blijven van het team; je verliest zelf de
              toegang ertoe en kunt ze niet meenemen.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={handleLeave}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Ja, team verlaten
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowConfirm(false)}>
                Annuleren
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
