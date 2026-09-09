import Link from "next/link";
import { ImageOff, MapPinned } from "lucide-react";

import { cn } from "@/lib/utils";
import { DOELGROEP_LABELS, type Activity } from "@/types/activity";
import type { LessonWithDetails } from "@/types/lesson";

// De samengevoegde bibliotheekpagina (/zoeken) toont twee verschillende
// brondata-vormen (Activity uit de activiteiten-tabel, LessonWithDetails uit
// de lessons-tabel) in één grid. `source` is de expliciete herkomst-marker
// die de brief vraagt — vastgelegd hier i.p.v. afgeleid uit welk veld
// aanwezig is, zodat het altijd ondubbelzinnig is.
export type LibraryListItem =
  | { source: "gymwiki"; id: string; activity: Activity }
  | { source: "public"; id: string; lesson: LessonWithDetails };

const TILE_CLASS =
  "flex flex-col overflow-hidden rounded-xl border border-l-4 bg-card shadow-brand-sm transition-transform duration-150 ease-brand active:scale-[0.98]";

// Blauw = GymWiki (de eigen merkkleur, zie --line-blue), oranje = extern/
// publiek gedeeld — dezelfde "cone"-accentkleur die elders al community-
// content markeert (bijv. ContributionStatusCard).
const SOURCE_STYLES = {
  gymwiki: {
    border: "border-l-line-blue",
    badge: "border-line-blue/30 bg-line-blue text-white",
    label: "GymWiki",
  },
  public: {
    border: "border-l-cone",
    badge: "border-cone/30 bg-cone text-ink",
    label: "Publiek",
  },
} as const;

/**
 * Klein herkomst-label — samen met de gekleurde linkerrand (zie
 * TILE_CLASS/SOURCE_STYLES) de tweeledige visuele distinctie die de brief
 * vraagt. Geen eigen positionering: in de kaart-hoek (grid) staat 'm z'n
 * ouder daarvoor `absolute`, op een detailpagina rendert 'm gewoon inline.
 */
export function SourceBadge({
  source,
  className,
}: {
  source: "gymwiki" | "public";
  className?: string;
}) {
  const style = SOURCE_STYLES[source];
  return (
    <span
      className={cn(
        "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold shadow-sm",
        style.badge,
        className,
      )}
    >
      {style.label}
    </span>
  );
}

function ActivityTile({ activity }: { activity: Activity }) {
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
      className={cn(TILE_CLASS, SOURCE_STYLES.gymwiki.border)}
    >
      <div className="relative flex h-28 items-center justify-center bg-muted">
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
        <SourceBadge source="gymwiki" className="absolute top-1.5 right-1.5" />
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

function LessonTile({ lesson }: { lesson: LessonWithDetails }) {
  const subtitle = [lesson.learning_line, lesson.group_name].filter(Boolean).join(" · ");
  const authorName = lesson.author
    ? `${lesson.author.first_name} ${lesson.author.last_name}`.trim()
    : null;

  return (
    <Link href={`/les/${lesson.id}`} className={cn(TILE_CLASS, SOURCE_STYLES.public.border)}>
      <div className="relative flex h-28 items-center justify-center bg-muted">
        {lesson.diagram_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage-URL
          <img
            src={lesson.diagram_image_url}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <MapPinned className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
        <SourceBadge source="public" className="absolute top-1.5 right-1.5" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <p className="line-clamp-2 text-sm font-semibold">{lesson.title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        {authorName && (
          <p className="truncate text-xs text-muted-foreground">Door {authorName}</p>
        )}
      </div>
    </Link>
  );
}

export function LibraryItemCard({ item }: { item: LibraryListItem }) {
  return item.source === "gymwiki" ? (
    <ActivityTile activity={item.activity} />
  ) : (
    <LessonTile lesson={item.lesson} />
  );
}
