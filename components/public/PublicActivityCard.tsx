import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { DOELGROEP_LABELS } from "@/types/activity";
import type { PublicActivity } from "@/lib/services/publicActivities";

/**
 * Kaart voor de publieke, niet-ingelogde SEO-oppervlakte
 * (/activiteiten/[slug]'s "Gerelateerde activiteiten", de
 * /leerlijn/[leerlijn]- en /groep/[groep]-lijsten) — bewust een EIGEN,
 * simpele component i.p.v. components/library-item-card.tsx hergebruiken:
 * die kaart linkt naar het ingelogde /activiteit/[id] en rendert
 * auth-afhankelijke elementen (bewaar-toggle, bronbadge). Deze kaart heeft
 * geen "use client" nodig en linkt altijd naar de publieke
 * /activiteiten/[slug]-route.
 */
export function PublicActivityCard({ activity }: { activity: PublicActivity }) {
  const doelgroepLabels = (activity.doelgroep ?? [])
    .map((code) => DOELGROEP_LABELS[code])
    .filter((label): label is string => Boolean(label));

  return (
    <Link
      href={`/activiteiten/${activity.slug}`}
      className="block overflow-hidden rounded-2xl border bg-card shadow-brand-sm transition-shadow duration-150 ease-brand hover:shadow-brand-md"
    >
      {activity.afbeelding && (
        <div className="relative h-32 w-full bg-muted">
          <Image
            src={activity.afbeelding}
            alt=""
            fill
            sizes="(min-width: 768px) 300px, 100vw"
            className="object-cover"
          />
        </div>
      )}
      <div className="space-y-1.5 p-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {activity.leerlijn || activity.categorie || "Activiteit"}
        </p>
        <h3 className="text-base font-semibold text-foreground">{activity.titel}</h3>
        <p className="line-clamp-3 text-sm text-muted-foreground">{activity.seo_summary}</p>
        {doelgroepLabels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {doelgroepLabels.map((label) => (
              <Badge key={label} variant="secondary">
                {label}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
