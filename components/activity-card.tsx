import Link from "next/link";
import { ImageOff } from "lucide-react";

import { DOELGROEP_LABELS, type Activity } from "@/types/activity";

export function ActivityCard({ activity }: { activity: Activity }) {
  const doelgroepLabel = (activity.doelgroep ?? [])
    .map((waarde) => DOELGROEP_LABELS[waarde])
    .filter((label): label is string => Boolean(label))
    .join(", ");
  const categorieLeerlijn = [activity.categorie, activity.leerlijn]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/activiteit/${activity.id}`}
      className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-brand-sm transition-transform duration-150 ease-brand active:scale-[0.98]"
    >
      <div className="flex h-28 items-center justify-center bg-muted">
        {activity.afbeelding ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, unregistered hosts (Firebase/Supabase Storage)
          <img
            src={activity.afbeelding}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <ImageOff className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <p className="line-clamp-2 text-sm font-semibold">{activity.titel}</p>
        {categorieLeerlijn && (
          <p className="truncate text-xs text-muted-foreground">{categorieLeerlijn}</p>
        )}
        {doelgroepLabel && (
          <p className="truncate text-xs text-muted-foreground">{doelgroepLabel}</p>
        )}
      </div>
    </Link>
  );
}
