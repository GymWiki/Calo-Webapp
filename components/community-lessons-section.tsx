import Link from "next/link";
import { Sparkles } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LessonCard } from "@/components/lesson-card";
import { Button } from "@/components/ui/button";
import type { LessonWithDetails } from "@/types/lesson";

export function CommunityLessonsSection({
  lessons,
  currentUserId,
}: {
  lessons: LessonWithDetails[];
  currentUserId?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Populair in de gymzaal</h2>
          <p className="text-sm text-muted-foreground">
            Recent gedeelde lessen van medestudenten en vakdocenten.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/bibliotheek">Bekijk alles in de bibliotheek →</Link>
        </Button>
      </div>

      {lessons.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nog geen openbare lessen"
          description="Zodra iemand een lesvoorbereiding openbaar deelt, verschijnt die hier."
          className="mt-4"
        />
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((lesson, index) => (
            <div
              key={lesson.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}
            >
              <LessonCard lesson={lesson} currentUserId={currentUserId} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
