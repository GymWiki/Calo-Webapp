import Link from "next/link";
import { BookOpen, Globe2, ImageOff, MapPinned } from "lucide-react";

import { getCategoryForLearningLine } from "@/lib/constants/learningLines";
import { getCategoryColor } from "@/lib/constants/categoryColors";
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

// Herkomst-badge is bewust grijstinten/inkt i.p.v. een kleur uit
// CATEGORY_COLORS (lib/constants/categoryColors.ts) — de linkerrand toont al
// de categorie in kleur, dus de bron mag daar niet mee concurreren of mee
// verward worden.
const SOURCE_STYLES = {
  gymwiki: {
    badge: "border-transparent bg-ink text-paper dark:bg-paper dark:text-ink",
    label: "GymWiki",
    icon: BookOpen,
  },
  public: {
    badge: "border-ink/20 bg-paper text-ink dark:border-paper/25 dark:bg-charcoal dark:text-paper",
    label: "Publiek",
    icon: Globe2,
  },
} as const;

/**
 * Klein herkomst-label — bewust los van de categoriekleur op de linkerrand
 * (zie TILE_CLASS/CATEGORY_COLORS): dit is de tweede, onafhankelijke
 * visuele distinctie die de brief vraagt (categorie via rand, bron via dit
 * label). Geen eigen positionering: in de kaart-hoek (grid) zet de ouder
 * 'm `absolute`, op een detailpagina rendert 'm gewoon inline.
 */
export function SourceBadge({
  source,
  className,
}: {
  source: "gymwiki" | "public";
  className?: string;
}) {
  const style = SOURCE_STYLES[source];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold shadow-sm",
        style.badge,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
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
      className={cn(TILE_CLASS, getCategoryColor(activity.categorie).border)}
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

  const category = getCategoryForLearningLine(lesson.learning_line ?? "");

  return (
    <Link href={`/les/${lesson.id}`} className={cn(TILE_CLASS, getCategoryColor(category).border)}>
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
