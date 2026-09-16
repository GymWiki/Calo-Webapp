"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ImageOff, Lock, Trash2, Users2 } from "lucide-react";
import { toast } from "sonner";

import { deleteActivityDraft } from "@/actions/activity-submission";
import { TILE_CLASS } from "@/components/library-item-card";
import { Button } from "@/components/ui/button";
import { ACTIVITY_STATUS_STYLES } from "@/lib/constants/activityStatus";
import { getCategoryColor } from "@/lib/constants/categoryColors";
import { getCategoryForLearningLine } from "@/lib/constants/learningLines";
import { cn } from "@/lib/utils";
import { DOELGROEP_LABELS, type Activity } from "@/types/activity";

// Zelfde fallback-titel als saveLessonDraft (actions/lesson.ts) schrijft voor
// een concept zonder titel — dat is de enige manier om hier "geen titel
// ingevuld" te herkennen, want de kolom zelf staat nooit leeg.
const UNTITLED_DRAFT_TITLE = "Naamloos concept";

function formatDraftTimestamp(value: string): string {
  const date = new Date(value);
  const datePart = date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  const timePart = date.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}

/**
 * Bibliotheek-achtige kaart voor "Mijn activiteiten" (zie
 * profiel/activiteiten): zelfde tegel-stijl als LibraryItemCard
 * (categoriekleur op de linkerrand, afbeelding, titel) — zie TILE_CLASS —
 * maar met status- en privé/gedeeld-badges i.p.v. een bron-badge, de juiste
 * bestemming per status, en een verwijder-actie voor concepten.
 */
export function MyActivityCard({ activity }: { activity: Activity }) {
  const router = useRouter();
  const [isDeleting, startDeleteTransition] = useTransition();
  const isDraft = activity.status === "draft";
  const isUntitledDraft = isDraft && activity.titel === UNTITLED_DRAFT_TITLE;

  const statusStyle = ACTIVITY_STATUS_STYLES[activity.status];
  const StatusIcon = statusStyle.icon;
  const category = activity.categorie ?? getCategoryForLearningLine(activity.leerlijn ?? "");
  const doelgroepLabel = (activity.doelgroep ?? [])
    .map((waarde) => DOELGROEP_LABELS[waarde])
    .filter((label): label is string => Boolean(label))
    .join(", ");
  const subtitle = [activity.leerlijn, activity.group_name].filter(Boolean).join(" · ");
  const image = activity.afbeelding ?? activity.diagram_image_url;
  const href = isDraft ? `/les-maken?vanuit=${activity.id}` : `/activiteit/${activity.id}`;

  function handleDelete() {
    if (!window.confirm(`"${activity.titel}" verwijderen? Dit kan niet ongedaan worden gemaakt.`)) {
      return;
    }
    startDeleteTransition(async () => {
      const result = await deleteActivityDraft(activity.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Concept verwijderd.");
      router.refresh();
    });
  }

  return (
    <div className={cn(TILE_CLASS, getCategoryColor(category ?? null).border, "relative")}>
      <Link href={href} className="flex flex-1 flex-col">
        <div className="relative flex h-28 items-center justify-center bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- external, unregistered hosts (Firebase/Supabase Storage)
            <img src={image} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <ImageOff className="size-6 text-muted-foreground" aria-hidden="true" />
          )}
          <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1">
            <span
              className={cn(
                "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold shadow-sm",
                statusStyle.variant === "success" && "border-transparent bg-success text-success-foreground",
                statusStyle.variant === "destructive" && "border-transparent bg-destructive text-white",
                statusStyle.variant === "secondary" && "border-transparent bg-secondary text-secondary-foreground",
                statusStyle.variant === "outline" && "border-ink/20 bg-paper text-ink dark:border-paper/25 dark:bg-charcoal dark:text-paper",
              )}
              title={
                activity.status === "rejected" && activity.rejection_reason
                  ? activity.rejection_reason
                  : undefined
              }
            >
              <StatusIcon className="size-3" aria-hidden="true" />
              {statusStyle.label}
            </span>
            {!isDraft && (
              <span className="flex items-center gap-1 rounded-md border border-ink/20 bg-paper px-1.5 py-0.5 text-[10px] font-semibold text-ink shadow-sm dark:border-paper/25 dark:bg-charcoal dark:text-paper">
                {activity.is_public ? (
                  <>
                    <Users2 className="size-3" aria-hidden="true" />
                    Gedeeld
                  </>
                ) : (
                  <>
                    <Lock className="size-3" aria-hidden="true" />
                    Privé
                  </>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1 p-2.5">
          <p className="line-clamp-2 text-sm font-semibold">
            {isUntitledDraft
              ? `Naamloos concept — aangemaakt ${formatDraftTimestamp(activity.created_at)}`
              : activity.titel}
          </p>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          {doelgroepLabel && <p className="truncate text-xs text-muted-foreground">{doelgroepLabel}</p>}
        </div>
      </Link>

      {isDraft && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute top-1.5 left-1.5 size-8 bg-card/90 backdrop-blur-sm"
          disabled={isDeleting}
          onClick={handleDelete}
          aria-label={`Concept "${activity.titel}" verwijderen`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
