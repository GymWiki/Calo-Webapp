import Link from "next/link";
import { ListPlus } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { ACTIVITY_STATUS_STYLES } from "@/lib/constants/activityStatus";
import type { Activity } from "@/types/activity";

/**
 * Dashboard-overzicht van eigen toegevoegde activiteiten met status per
 * stuk — zodat "toegevoegd, wordt gecontroleerd" geen black box is: de
 * gebruiker ziet hier altijd of iets meetelt voor de maandelijkse bijdrage
 * of aangepast moet worden. Puur een statusoverzicht — er bestaat geen
 * losse "activiteit toevoegen"-invoerroute meer (verwijderd, zie
 * lesson-flow.tsx): nieuwe bijdragen ontstaan nu altijd via een les die in
 * de les-maken wizard wordt afgerond en openbaar gemaakt.
 */
export function OwnActivitiesSection({ activities }: { activities: Activity[] }) {
  return (
    <div>
      <div>
        <h2 className="text-lg font-semibold">Mijn activiteiten</h2>
        <p className="text-sm text-muted-foreground">
          Status per toegevoegde activiteit — alleen goedgekeurde tellen mee voor je
          maandelijkse bijdrage.
        </p>
      </div>

      {activities.length === 0 ? (
        <EmptyState
          icon={ListPlus}
          title="Nog geen activiteiten toegevoegd"
          description="Maak en publiceer een les via de les-maken wizard om bij te dragen aan de bibliotheek."
          className="mt-4"
          action={
            <Link
              href="/les-maken"
              className="text-sm font-medium text-primary hover:underline"
            >
              Naar de les-maken wizard →
            </Link>
          }
        />
      ) : (
        <div className="mt-4 space-y-2">
          {activities.map((activity) => {
            const style = ACTIVITY_STATUS_STYLES[activity.status];
            const Icon = style.icon;
            // Een concept heeft niets te bekijken — het gaat verder waar je
            // gebleven was, in dezelfde inline-editor die het opsloeg (zie
            // actions/lesson.ts's saveLessonDraft + les-maken/page.tsx).
            const href =
              activity.status === "draft"
                ? `/les-maken?vanuit=${activity.id}`
                : `/activiteit/${activity.id}`;
            return (
              <Link
                key={activity.id}
                href={href}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 transition-colors duration-150 ease-brand hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{activity.titel}</p>
                  {activity.status === "rejected" && activity.rejection_reason && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {activity.rejection_reason}
                    </p>
                  )}
                </div>
                <Badge variant={style.variant} className="shrink-0">
                  <Icon className="size-3" />
                  {style.label}
                </Badge>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
