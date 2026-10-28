import Image from "next/image";
import Link from "next/link";
import { Box } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { hasFloorplanThumbnail } from "@/lib/services/landing";
import type { PublicActivity } from "@/lib/services/publicActivities";
import { DOELGROEP_LABELS } from "@/types/activity";

/** Activiteitkaart voor de landingspagina: vaste beeldverhouding (geen layout shift), 3D-badge als de afbeelding een 3D-plattegrond is. */
export function LandingActivityCard({ activity, priority = false, compact = false }: { activity: PublicActivity; priority?: boolean; compact?: boolean }) {
  const groups = (activity.doelgroep ?? []).map((code) => DOELGROEP_LABELS[code]).filter(Boolean).slice(0, 2);
  const threeD = hasFloorplanThumbnail(activity);
  return (
    <Link
      href={`/activiteiten/${activity.slug}`}
      className="group block overflow-hidden rounded-2xl border bg-card shadow-brand-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-brand-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="relative aspect-[16/10] w-full bg-muted">
        {activity.afbeelding && (
          <Image
            src={activity.afbeelding}
            alt=""
            fill
            priority={priority}
            sizes={compact ? "(min-width: 1024px) 220px, 45vw" : "(min-width: 1024px) 360px, (min-width: 640px) 45vw, 100vw"}
            className="object-cover"
          />
        )}
        {threeD && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-[0.7rem] font-semibold shadow-sm">
            <Box className="size-3 text-primary" aria-hidden="true" /> 3D-plattegrond
          </span>
        )}
      </div>
      <div className={compact ? "space-y-1 p-3" : "space-y-1.5 p-4"}>
        <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">{activity.leerlijn || activity.categorie || "Activiteit"}</p>
        <h3 className={compact ? "line-clamp-2 text-sm font-semibold" : "line-clamp-2 text-base font-semibold"}>{activity.titel}</h3>
        {!compact && (
          <>
            <p className="line-clamp-2 text-sm text-muted-foreground">{activity.seo_summary}</p>
            {groups.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {groups.map((label) => (
                  <Badge key={label} variant="secondary">
                    {label}
                  </Badge>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Link>
  );
}
