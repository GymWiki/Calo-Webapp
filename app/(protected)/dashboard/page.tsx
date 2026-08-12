import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, NotebookPen, SquarePen, Trophy } from "lucide-react";

import { CommunityLessonsSection } from "@/components/community-lessons-section";
import { EmptyState } from "@/components/empty-state";
import { LessonCard } from "@/components/lesson-card";
import { PageHeader } from "@/components/page-header";
import { QuickActionGrid } from "@/components/quick-action-grid";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { getPublicLessons, getUserLessons } from "@/lib/services/lessons";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import type { LessonWithDetails } from "@/types/lesson";

const COMMUNITY_LIMIT = 6;

export default async function DashboardPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Dashboard"
        title={`Welkom terug, ${profile.first_name}`}
        description="Hier vind je je snelle acties, je lesvoorbereidingen en wat er speelt in de community."
      />

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent userId={profile.id} />
      </Suspense>
    </main>
  );
}

function countThisMonth(lessons: LessonWithDetails[]) {
  const now = new Date();
  return lessons.filter((lesson) => {
    const created = new Date(lesson.created_at);
    return (
      created.getMonth() === now.getMonth() &&
      created.getFullYear() === now.getFullYear()
    );
  }).length;
}

async function DashboardContent({ userId }: { userId: string }) {
  const [lessons, publicLessons] = await Promise.all([
    getUserLessons(userId),
    getPublicLessons(),
  ]);
  const latest = lessons[0];
  const communityLessons = publicLessons.slice(0, COMMUNITY_LIMIT);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          icon={NotebookPen}
          label="Lessen gemaakt"
          value={lessons.length}
          accent="cone"
        />
        <StatCard
          icon={CalendarDays}
          label="Deze maand"
          value={countThisMonth(lessons)}
          accent="blue"
        />
        <StatCard
          icon={Trophy}
          label="Laatste les"
          value={latest ? (formatDate(latest.created_at) ?? "-") : "-"}
          meta={latest?.title}
          accent="yellow"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <QuickActionGrid />

      <div>
        <h2 className="text-lg font-semibold">Mijn lessen</h2>
        {lessons.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title="Nog geen lessen gemaakt"
            description="Zodra je een lesvoorbereiding aanmaakt, verschijnt hij hier — inclusief PDF-export, delen en plattegrond."
            action={
              <Button asChild>
                <Link href="/les-maken">
                  <SquarePen className="size-4" />
                  Eerste les maken
                </Link>
              </Button>
            }
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
                <LessonCard lesson={lesson} currentUserId={userId} />
              </div>
            ))}
          </div>
        )}
      </div>

      <CommunityLessonsSection lessons={communityLessons} currentUserId={userId} />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
      <div>
        <Skeleton className="h-5 w-28" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-xl border bg-card p-6">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
