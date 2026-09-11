"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookMarked } from "lucide-react";
import { toast } from "sonner";

import { setKnowledgePackagePreference } from "@/actions/knowledgePackages";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Switch } from "@/components/ui/switch";
import type { KnowledgePackageWithPreference } from "@/types/knowledgePackages";

/**
 * Stap 6: aan/uitzetbare Standaardbibliotheek-pakketten, visueel duidelijk
 * onderscheiden van de eigen-documenten-lijst (KnowledgeDocumentList) door
 * een eigen kaartstijl + icoon i.p.v. hergebruik van diens layout.
 */
export function KnowledgePackageList({
  packages,
}: {
  packages: KnowledgePackageWithPreference[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  function handleToggle(packageId: string, name: string, nextEnabled: boolean) {
    setOptimistic((prev) => ({ ...prev, [packageId]: nextEnabled }));
    startTransition(async () => {
      const result = await setKnowledgePackagePreference(packageId, nextEnabled);

      if ("error" in result) {
        setOptimistic((prev) => ({ ...prev, [packageId]: !nextEnabled }));
        toast.error(result.error);
        return;
      }

      toast.success(
        nextEnabled
          ? `"${name}" telt nu mee in je AI-context.`
          : `"${name}" telt niet meer mee in je AI-context.`,
      );
      router.refresh();
    });
  }

  if (packages.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <EmptyState
            icon={BookMarked}
            title="Nog geen pakketten beschikbaar"
            description="Zodra GymWiki een literatuurpakket (bijv. CALO-leerlijnen of het Athletic Skills Model) toevoegt, verschijnt het hier om aan of uit te zetten."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-2">
      {packages.map((pkg) => {
        const enabled = optimistic[pkg.id] ?? pkg.enabled;
        return (
          <li key={pkg.id}>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <BookMarked className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <p className="font-medium">{pkg.name}</p>
                  </div>
                  {pkg.description && (
                    <p className="text-sm text-muted-foreground">{pkg.description}</p>
                  )}
                  {pkg.source_attribution && (
                    <p className="text-xs text-muted-foreground italic">
                      Bron: {pkg.source_attribution}
                    </p>
                  )}
                </div>
                <Switch
                  checked={enabled}
                  disabled={isPending}
                  onCheckedChange={(next) => handleToggle(pkg.id, pkg.name, next)}
                  id={`package-${pkg.id}`}
                />
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
