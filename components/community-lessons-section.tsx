import Link from "next/link";
import { Sparkles } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LessonCard } from "@/components/lesson-card";
import { Button } from "@/components/ui/button";
import type { Activity } from "@/types/activity";

export function CommunityLessonsSection({
  activities,
  currentUserId,
}: {
  activities: Activity[];
  currentUserId?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Populair in de gymzaal</h2>
          <p className="text-sm text-muted-foreground">
            Recent gedeelde activiteiten van medestudenten en vakdocenten.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/zoeken">Bekijk alles in de bibliotheek →</Link>
        </Button>
      </div>

      {activities.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nog geen openbare activiteiten"
          description="Zodra iemand een activiteit openbaar deelt, verschijnt die hier."
          className="mt-4"
        />
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}
            >
              <LessonCard activity={activity} currentUserId={currentUserId} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
