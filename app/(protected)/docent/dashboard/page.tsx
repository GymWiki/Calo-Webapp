import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  NotebookPen,
  SquarePen,
  Swords,
  Trophy,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LessonCard } from "@/components/lesson-card";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { getUserLessons } from "@/lib/services/lessons";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import type { LessonWithDetails } from "@/types/lesson";

export default async function DocentDashboardPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Dashboard"
        title={`Welkom terug, ${profile.first_name}`}
        description="Beheer je eigen lesvoorbereidingen en ontdek wat andere docenten delen in de bibliotheek."
        action={
          <Button asChild>
            <Link href="/les-maken">
              <SquarePen className="size-4" />
              Nieuwe les
            </Link>
          </Button>
        }
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
  const lessons = await getUserLessons(userId);
  const latest = lessons[0];

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/docent/bibliotheek"
          className="group flex items-center justify-between rounded-2xl border bg-card p-5 shadow-brand-sm transition-transform duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-brand-md"
        >
          <div className="flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-line-blue/10 text-line-blue">
              <BookOpen className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold">Bibliotheek</p>
              <p className="text-sm text-muted-foreground">
                Blader door openbare lesvoorbereidingen van andere docenten.
              </p>
            </div>
          </div>
          <span className="hidden text-sm font-medium text-line-blue sm:inline group-hover:underline">
            Bekijken →
          </span>
        </Link>

        <Link
          href="/toernooi"
          className="group flex items-center justify-between rounded-2xl border bg-card p-5 shadow-brand-sm transition-transform duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-brand-md"
        >
          <div className="flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-line-blue/10 text-line-blue">
              <Swords className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold">Toernooi Generator</p>
              <p className="text-sm text-muted-foreground">
                Genereer binnen een minuut een eerlijk wedstrijdschema.
              </p>
            </div>
          </div>
          <span className="hidden text-sm font-medium text-line-blue sm:inline group-hover:underline">
            Starten →
          </span>
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Jouw lessen</h2>
        {lessons.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title="Nog geen lessen gemaakt"
            description="Zodra je een lesvoorbereiding aanmaakt, verschijnt hij hier — inclusief PDF-export en plattegrond."
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
                <LessonCard lesson={lesson} />
              </div>
            ))}
          </div>
        )}
      </div>
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
      <Skeleton className="h-20 w-full rounded-2xl" />
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
