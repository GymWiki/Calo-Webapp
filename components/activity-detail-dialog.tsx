"use client";

import Link from "next/link";
import { Bookmark, BookmarkCheck, Copy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DOELGROEP_LABELS, type Activity } from "@/types/activity";

function TipList({ title, tips }: { title: string; tips: string[] | null }) {
  if (!tips || tips.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </div>
  );
}

export function ActivityDetailDialog({
  activity,
  open,
  onOpenChange,
  saved,
  pending,
  onToggleSave,
}: {
  activity: Activity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: boolean;
  pending: boolean;
  onToggleSave: () => void;
}) {
  const doelgroepLabels = (activity.doelgroep ?? [])
    .map((waarde) => DOELGROEP_LABELS[waarde])
    .filter((label): label is string => Boolean(label));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{activity.titel}</DialogTitle>
          {activity.doel && <DialogDescription>{activity.doel}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {activity.categorie && <Badge>{activity.categorie}</Badge>}
          {activity.leerlijn && <Badge variant="secondary">{activity.leerlijn}</Badge>}
          {activity.beweegthema && (
            <Badge variant="outline">{activity.beweegthema}</Badge>
          )}
          {activity.niveau && <Badge variant="outline">Niveau {activity.niveau}</Badge>}
          {doelgroepLabels.map((label) => (
            <Badge key={label} variant="outline">
              {label}
            </Badge>
          ))}
        </div>

        <div className="space-y-4">
          {activity.beginsituatie && (
            <div>
              <h4 className="text-sm font-semibold text-foreground">Beginsituatie</h4>
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
                {activity.beginsituatie}
              </p>
            </div>
          )}

          {activity.beschrijving && (
            <div>
              <h4 className="text-sm font-semibold text-foreground">Beschrijving</h4>
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
                {activity.beschrijving}
              </p>
            </div>
          )}

          {activity.materiaal && activity.materiaal.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground">Materiaal</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {activity.materiaal.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {activity.regels && activity.regels.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground">Regels</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {activity.regels.map((regel) => (
                  <li key={regel}>{regel}</li>
                ))}
              </ul>
            </div>
          )}

          <TipList title="Loopt het?" tips={activity.loopt} />
          <TipList title="Lukt het?" tips={activity.lukt} />
          <TipList title="Leeft het?" tips={activity.leeft} />
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onToggleSave}>
            {saved ? (
              <BookmarkCheck className="size-4 text-primary" />
            ) : (
              <Bookmark className="size-4" />
            )}
            {saved ? "Opgeslagen" : "Bewaren in mijn lessen"}
          </Button>
          <Button asChild>
            <Link href={`/les-maken?vanuit=${activity.id}`}>
              <Copy className="size-4" />
              Kopieer & bewerk
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
