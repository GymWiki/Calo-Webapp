"use client";

import { useState } from "react";
import { ListTodo, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UnplacedContentItem } from "@/lib/ai/extractedActivityMapping";

// Welke vrije-tekst-/lijst-velden een "Niet geplaatst"-item naartoe
// verplaatst kan worden — bewust alleen de velden waar een los stukje tekst
// zinvol bij kan ("Titel"/"Leerlijn" bijv. niet). Tekstvelden krijgen het
// item als nieuwe regel toegevoegd, lijstvelden als nieuw item — zie de
// aanroeper (lesson-form.tsx) voor de daadwerkelijke merge-logica.
export const UNPLACED_TARGET_FIELDS = [
  { field: "goals", label: "Doel", kind: "text" },
  { field: "beschrijving", label: "Beschrijving", kind: "text" },
  { field: "rules", label: "Regels", kind: "list" },
  { field: "learningOutcomes", label: "Leeruitkomsten", kind: "list" },
  { field: "aandachtspunten", label: "Aandachtspunten", kind: "text" },
  { field: "movementProblem", label: "Beginsituatie", kind: "text" },
  { field: "deelnemersRegels", label: "Deelnemers & Regels", kind: "text" },
  { field: "arrangement", label: "Arrangement", kind: "text" },
] as const;

export type UnplacedTargetField = (typeof UNPLACED_TARGET_FIELDS)[number]["field"];

/**
 * Dekkingscheck-UI ("geen dataverlies", zie lib/ai/activityImportExtraction.ts's
 * commentaar bij "unplacedContent"): toont elk stuk brontekst dat de AI
 * nergens kon plaatsen, met de keuze het alsnog naar een veld te verplaatsen
 * of te negeren. Puur client-state — de aanroeper verwerkt de daadwerkelijke
 * veldwijziging via de bestaande onChange-handlers.
 */
export function UnplacedContentPanel({
  items,
  onPlace,
  onDiscard,
}: {
  items: UnplacedContentItem[];
  onPlace: (index: number, field: UnplacedTargetField) => void;
  onDiscard: (index: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <Card className="animate-fade-up border-amber-400/50 bg-amber-50 dark:bg-amber-950/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="size-4 text-amber-600" aria-hidden="true" />
          Niet geplaatst
        </CardTitle>
        <CardDescription>
          Deze tekst uit het document kon de AI nergens in een veld plaatsen — verplaats &apos;m handmatig naar
          het juiste veld, of negeer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <UnplacedItemRow
            key={index}
            item={item}
            onPlace={(field) => onPlace(index, field)}
            onDiscard={() => onDiscard(index)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function UnplacedItemRow({
  item,
  onPlace,
  onDiscard,
}: {
  item: UnplacedContentItem;
  onPlace: (field: UnplacedTargetField) => void;
  onDiscard: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="rounded-lg border bg-background p-3 text-sm">
      <p className="whitespace-pre-line text-foreground">{item.text}</p>
      {item.note && <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {pickerOpen ? (
          <>
            {UNPLACED_TARGET_FIELDS.map(({ field, label }) => (
              <Button key={field} type="button" size="sm" variant="outline" onClick={() => onPlace(field)}>
                {label}
              </Button>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={() => setPickerOpen(false)}>
              Annuleren
            </Button>
          </>
        ) : (
          <>
            <Button type="button" size="sm" onClick={() => setPickerOpen(true)}>
              Verplaats naar veld
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onDiscard}>
              <X className="size-3.5" />
              Negeren
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
