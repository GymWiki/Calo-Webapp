import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { GenerateLessonsButton } from "@/components/planning/GenerateLessonsButton";
import { PageHeader } from "@/components/page-header";
import { WeekPlanningView } from "@/components/planning/WeekPlanningView";
import { YearPlanTimeline } from "@/components/planning/YearPlanTimeline";
import { getAllActivities, getOwnSubmissions } from "@/lib/services/activities";
import { getClassById, getPlannedLessons, getYearPlanBlocks } from "@/lib/services/planning";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { DOELGROEP_LABELS } from "@/types/activity";
import type { Activity } from "@/types/activity";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function PlanningClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const klas = await getClassById(classId);
  if (!klas) {
    notFound();
  }

  const [yearPlanBlocks, plannedLessons, publicActivities, ownActivities] = await Promise.all([
    getYearPlanBlocks(classId),
    getPlannedLessons(classId, { from: todayIso() }),
    getAllActivities(),
    getOwnSubmissions(profile.id),
  ]);

  // Eigen (mogelijk privé) activiteiten + de gedeelde bibliotheek, gededupliceerd
  // — een eigen activiteit kan ook al in getAllActivities zitten als hij
  // publiek gedeeld is.
  const activitiesById = new Map<string, Activity>();
  for (const activity of [...publicActivities, ...ownActivities]) {
    activitiesById.set(activity.id, activity);
  }
  const pickableActivities = [...activitiesById.values()].sort((a, b) =>
    a.titel.localeCompare(b.titel),
  );

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-6xl">
      <Link
        href="/profiel/planning"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Alle klassen
      </Link>

      <PageHeader
        eyebrow="Planning"
        title={klas.name}
        description={DOELGROEP_LABELS[klas.doelgroep]}
        action={<GenerateLessonsButton classId={classId} />}
      />

      {/* Op mobiel/tablet staat de weekplanning (order-1) primair bovenaan —
          "wat geef ik morgen" is direct bruikbaar; de jaarplanning-timeline
          (order-2) is een aparte, horizontaal scrollbare sectie eronder. Op
          desktop (lg:) draait de volgorde om: de jaarplanning-timeline geeft
          eerst het jaaroverzicht, de weekplanning daaronder het actionable
          detail — een gestapelde layout i.p.v. twee kolommen, want een
          weken-timeline werkt beter over de volle breedte dan gehalveerd. */}
      <div className="flex flex-col gap-6">
        <div className="order-2 lg:order-1">
          <YearPlanTimeline classId={classId} blocks={yearPlanBlocks} />
        </div>
        <div className="order-1 lg:order-2">
          <WeekPlanningView
            classId={classId}
            doelgroep={klas.doelgroep}
            initialLessons={plannedLessons}
            activities={pickableActivities}
          />
        </div>
      </div>
    </main>
  );
}
