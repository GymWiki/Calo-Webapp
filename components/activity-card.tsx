"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, Copy, Eye, ImageOff } from "lucide-react";
import { toast } from "sonner";

import { toggleSavedActivity } from "@/actions/activity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DOELGROEP_LABELS, type Activity } from "@/types/activity";

const MATERIAAL_PREVIEW_COUNT = 3;

export function ActivityCard({
  activity,
  initiallySaved,
}: {
  activity: Activity;
  initiallySaved: boolean;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();
  const [imageFailed, setImageFailed] = useState(false);

  function handleToggleSave() {
    const next = !saved;
    setSaved(next); // optimistic

    startTransition(async () => {
      const result = await toggleSavedActivity(activity.id);
      if ("error" in result) {
        setSaved(!next); // revert
        toast.error(result.error);
      }
    });
  }

  const materiaal = activity.materiaal ?? [];
  const materiaalPreview = materiaal.slice(0, MATERIAAL_PREVIEW_COUNT).join(", ");
  const materiaalMore = materiaal.length - MATERIAAL_PREVIEW_COUNT;
  const doelgroepLabels = (activity.doelgroep ?? [])
    .map((waarde) => DOELGROEP_LABELS[waarde])
    .filter((label): label is string => Boolean(label));

  return (
    <Card className="flex flex-col overflow-hidden transition-transform duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-brand-md">
      <Link href={`/activiteit/${activity.id}`} className="flex aspect-video items-center justify-center bg-muted">
        {activity.afbeelding && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, unregistered hosts (Firebase/Supabase Storage)
          <img
            src={activity.afbeelding}
            alt=""
            className="size-full object-cover"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <ImageOff className="size-8 text-muted-foreground" aria-hidden="true" />
        )}
      </Link>
      <CardHeader>
        <CardTitle className="text-base">
          <Link href={`/activiteit/${activity.id}`} className="hover:underline">
            {activity.titel}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="flex flex-wrap gap-2">
          {activity.leerlijn && <Badge variant="secondary">{activity.leerlijn}</Badge>}
          {activity.beweegthema && (
            <Badge variant="outline">{activity.beweegthema}</Badge>
          )}
          {activity.niveau && (
            <Badge variant="outline">Niveau {activity.niveau}</Badge>
          )}
        </div>
        {doelgroepLabels.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {doelgroepLabels.join(" · ")}
          </p>
        )}
        {materiaal.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {materiaalPreview}
            {materiaalMore > 0 && ` +${materiaalMore} meer`}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button asChild variant="outline" className="w-full">
          <Link href={`/activiteit/${activity.id}`}>
            <Eye className="size-4" />
            Bekijk Lesvoorbereiding
          </Link>
        </Button>
        <Button
          variant="outline"
          className="w-full"
          aria-pressed={saved}
          disabled={pending}
          onClick={handleToggleSave}
        >
          {saved ? (
            <BookmarkCheck className="size-4 text-primary" />
          ) : (
            <Bookmark className="size-4" />
          )}
          {saved ? "Opgeslagen in mijn lessen" : "Bewaren in mijn lessen"}
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/les-maken?vanuit=${activity.id}`}>
            <Copy className="size-4" />
            Kopieer & bewerk
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
