import Link from "next/link";
import { ListPlus } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACTIVITY_STATUS_STYLES } from "@/lib/constants/activityStatus";
import type { Activity } from "@/types/activity";

/**
 * Dashboard-overzicht van eigen toegevoegde activiteiten met status per
 * stuk — zodat "toegevoegd, wordt gecontroleerd" geen black box is: de
 * gebruiker ziet hier altijd of iets meetelt voor de maandelijkse bijdrage
 * of aangepast moet worden.
 */
export function OwnActivitiesSection({ activities }: { activities: Activity[] }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Mijn activiteiten</h2>
          <p className="text-sm text-muted-foreground">
            Status per toegevoegde activiteit — alleen goedgekeurde tellen mee voor je
            maandelijkse bijdrage.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/activiteit-toevoegen">
            <ListPlus className="size-4" />
            Activiteit toevoegen
          </Link>
        </Button>
      </div>

      {activities.length === 0 ? (
        <EmptyState
          icon={ListPlus}
          title="Nog geen activiteiten toegevoegd"
          description="Voeg een activiteit toe aan de bibliotheek — je ziet de status meteen na het toevoegen."
          className="mt-4"
          action={
            <Button asChild>
              <Link href="/activiteit-toevoegen">Activiteit toevoegen</Link>
            </Button>
          }
        />
      ) : (
        <div className="mt-4 space-y-2">
          {activities.map((activity) => {
            const style = ACTIVITY_STATUS_STYLES[activity.status];
            const Icon = style.icon;
            return (
              <Link
                key={activity.id}
                href={`/activiteit/${activity.id}`}
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
