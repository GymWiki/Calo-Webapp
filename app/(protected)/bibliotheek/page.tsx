import { Suspense } from "react";
import { BookOpen } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LessonCard } from "@/components/lesson-card";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicLessons } from "@/lib/services/lessons";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default function BibliotheekPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Bibliotheek"
        title="Openbare lesvoorbereidingen"
        description="Lessen die medestudenten en docenten publiekelijk hebben gedeeld, in één overzicht."
      />

      <Suspense fallback={<BibliotheekSkeleton />}>
        <BibliotheekContent />
      </Suspense>
    </main>
  );
}

async function BibliotheekContent() {
  const [lessons, profile] = await Promise.all([
    getPublicLessons(),
    getCurrentUserProfile(),
  ]);

  if (lessons.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Nog geen openbare lessen"
        description="Zodra iemand een lesvoorbereiding openbaar deelt, verschijnt die hier voor de hele community."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lessons.map((lesson, index) => (
        <div
          key={lesson.id}
          className="animate-fade-up"
          style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}
        >
          <LessonCard lesson={lesson} currentUserId={profile?.id} />
        </div>
      ))}
    </div>
  );
}

function BibliotheekSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-card p-6">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
