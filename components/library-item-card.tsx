import Image from "next/image";
import Link from "next/link";
import { BookOpen, ImageOff, Lock, MapPinned, Users } from "lucide-react";

import { getActivitySource, type ActivitySource } from "@/lib/activity-source";
import { getCategoryColor } from "@/lib/constants/categoryColors";
import { cn } from "@/lib/utils";
import { DOELGROEP_LABELS, type Activity } from "@/types/activity";

// Bron wordt niet meer via dit veld getoond (zie ActivityTile, die 'm vers
// afleidt via getActivitySource — lib/activity-source.ts) — nog wel gezet
// door de aanroepers en gebruikt als deel van de React-key. "gymwiki"/
// "public" i.p.v. de drie ActivitySource-waarden: puur historisch, niet
// meer betekenisvol voor weergave.
export type LibraryListItem = {
  source: "gymwiki" | "public";
  id: string;
  activity: Activity;
};

// Geëxporteerd zodat components/my-activity-card.tsx ("Mijn activiteiten",
// zie de brief "dezelfde kaartcomponent als de bibliotheek") exact dezelfde
// tegel-omlijning/schaduw/radius deelt, i.p.v. een losse kopie die uit de
// pas kan gaan lopen.
export const TILE_CLASS =
  "flex flex-col overflow-hidden rounded-xl border border-l-4 bg-card shadow-brand-sm transition-transform duration-150 ease-brand active:scale-[0.98]";

// Herkomst-badge is bewust los van CATEGORY_COLORS (lib/constants/categoryColors.ts)
// — de linkerrand toont al de categorie in kleur, dus de bron mag daar niet
// mee concurreren of mee verward worden. Elke bron krijgt nu ook zijn eigen,
// onderscheidende kleur (niet langer alle drie grijstinten/inkt): GymWiki
// blijft donker/zwart, Publiek wordt groen (een gedeelde, door de AI-check
// goedgekeurde bijdrage van iemand anders), Eigen wordt een neutrale
// outline (een privé concept/activiteit, alleen zichtbaar voor de auteur
// zelf) — zodat "is dit van mij, van iemand anders, of bibliotheek-basis"
// in één oogopslag duidelijk is.
const SOURCE_STYLES: Record<ActivitySource, { badge: string; label: string; icon: typeof BookOpen }> = {
  gymwiki: {
    badge: "border-transparent bg-ink text-paper dark:bg-paper dark:text-ink",
    label: "GymWiki",
    icon: BookOpen,
  },
  publiek: {
    badge: "border-transparent bg-emerald-600 text-white",
    label: "Publiek",
    icon: Users,
  },
  eigen: {
    badge: "border-slate-300 bg-white text-slate-700",
    label: "Eigen",
    icon: Lock,
  },
};

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
  source: ActivitySource;
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

function ActivityTile({
  activity,
  locked = false,
}: {
  activity: Activity;
  locked?: boolean;
}) {
  // Vers afgeleid uit de activiteit zelf (author_id/is_public) i.p.v. een
  // apart, van buitenaf meegegeven "source"-veld te vertrouwen — dat kon
  // uit de pas lopen met de werkelijke is_public-status (zie
  // lib/activity-source.ts's toelichting) en toonde een eigen, privé
  // activiteit soms onterecht als "Publiek".
  const source = getActivitySource(activity);
  const doelgroepLabel = (activity.doelgroep ?? [])
    .map((waarde) => DOELGROEP_LABELS[waarde])
    .filter((label): label is string => Boolean(label))
    .join(", ");
  const subtitle =
    source === "gymwiki"
      ? [activity.categorie, activity.leerlijn].filter(Boolean).join(" · ")
      : activity.leerlijn ?? "";
  const image = activity.afbeelding ?? activity.diagram_image_url;

  return (
    <Link
      href={`/activiteit/${activity.id}`}
      className={cn(TILE_CLASS, "relative", getCategoryColor(activity.categorie).border)}
      // Titel/thumbnail zijn met opzet vervaagd (zie hieronder) — een
      // screenreader mag die inhoud dan ook niet gewoon voorlezen, dat zou
      // de schaarste-prikkel voor sighted en assistive-tech-gebruikers uit
      // elkaar laten lopen.
      aria-label={locked ? "Vergrendelde activiteit — rond je bijdrage af of upgrade voor toegang" : undefined}
    >
      <div
        className={cn("relative flex h-28 items-center justify-center bg-muted", locked && "blur-sm")}
        aria-hidden={locked || undefined}
      >
        {image ? (
          <Image
            src={image}
            // Leeg bij locked (zie de aria-label hierboven): een screenreader
            // mag vervaagde inhoud niet gewoon voorlezen. Anders de titel —
            // beschrijvende alt-tekst i.p.v. leeg, relevant voor zowel
            // toegankelijkheid als afbeeldingen-SEO op de publieke
            // landingspagina/bibliotheek-preview (app/page.tsx).
            alt={locked ? "" : activity.titel}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="object-cover"
          />
        ) : source !== "gymwiki" ? (
          <MapPinned className="size-6 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ImageOff className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
        {!locked && <SourceBadge source={source} className="absolute top-1.5 right-1.5" />}
      </div>
      <div
        className={cn("flex flex-1 flex-col gap-1 p-2.5", locked && "blur-sm")}
        aria-hidden={locked || undefined}
      >
        <p className="line-clamp-2 text-sm font-semibold">{activity.titel}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        {doelgroepLabel && (
          <p className="truncate text-xs text-muted-foreground">{doelgroepLabel}</p>
        )}
      </div>
      {locked && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-background/35"
          aria-hidden="true"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-ink/85 text-paper shadow-brand-sm dark:bg-paper/85 dark:text-ink">
            <Lock className="size-4" />
          </span>
        </div>
      )}
    </Link>
  );
}

export function LibraryItemCard({
  item,
  locked = false,
}: {
  item: LibraryListItem;
  /**
   * Preview-slot voor free_blocked-gebruikers (zie de brief): vervaagt
   * titel/thumbnail (CSS blur) en toont een slotje i.p.v. de kaart simpelweg
   * niet te renderen — het "kijk wat je mist"-effect vereist dat de
   * aanwezigheid van de activiteit zichtbaar blijft. Klikken navigeert nog
   * altijd gewoon naar /activiteit/[id] — DIE pagina handhaaft de
   * daadwerkelijke blokkade (zie hasFullLibraryAccess/isOwnActivity daar),
   * dus geen aparte client-side klik-onderschepping nodig hier.
   */
  locked?: boolean;
}) {
  return <ActivityTile activity={item.activity} locked={locked} />;
}
