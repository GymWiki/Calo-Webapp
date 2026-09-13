import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CalendarDays, ListChecks, Trophy } from "lucide-react";

import { CommunityLessonsSection } from "@/components/community-lessons-section";
import { ContributionStatusCard } from "@/components/ContributionStatusCard";
import { OwnActivitiesSection } from "@/components/own-activities-section";
import { PageHeader } from "@/components/page-header";
import { QuickActionGrid } from "@/components/quick-action-grid";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { getContributionStatus } from "@/lib/services/contribution";
import { getOwnSubmissions, getPublicActivities } from "@/lib/services/activities";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { createClient } from "@/utils/supabase/server";
import type { Activity } from "@/types/activity";

const COMMUNITY_LIMIT = 6;
const OWN_ACTIVITIES_LIMIT = 5;

export default async function DashboardPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const contributionStatus = await getContributionStatus(
    supabase,
    profile.id,
    profile.subscription_status,
  );

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Dashboard"
        title={`Welkom terug, ${profile.first_name}`}
        description="Hier vind je je snelle acties, je activiteiten en wat er speelt in de community."
      />

      <ContributionStatusCard
        status={contributionStatus}
        subscriptionStatus={profile.subscription_status}
      />

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent userId={profile.id} />
      </Suspense>
    </main>
  );
}

function countThisMonth(activities: Activity[]) {
  const now = new Date();
  return activities.filter((activity) => {
    const created = new Date(activity.submitted_at);
    return (
      created.getMonth() === now.getMonth() &&
      created.getFullYear() === now.getFullYear()
    );
  }).length;
}

async function DashboardContent({ userId }: { userId: string }) {
  const [ownActivities, publicActivities] = await Promise.all([
    getOwnSubmissions(userId),
    getPublicActivities(),
  ]);
  const latest = ownActivities[0];
  const communityActivities = publicActivities.slice(0, COMMUNITY_LIMIT);
  const recentOwnActivities = ownActivities.slice(0, OWN_ACTIVITIES_LIMIT);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          icon={ListChecks}
          label="Activiteiten gemaakt"
          value={ownActivities.length}
          accent="cone"
        />
        <StatCard
          icon={CalendarDays}
          label="Deze maand"
          value={countThisMonth(ownActivities)}
          accent="blue"
        />
        <StatCard
          icon={Trophy}
          label="Laatste activiteit"
          value={latest ? (formatDate(latest.submitted_at) ?? "-") : "-"}
          meta={latest?.titel}
          accent="yellow"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <QuickActionGrid />

      <OwnActivitiesSection activities={recentOwnActivities} />

      <CommunityLessonsSection activities={communityActivities} currentUserId={userId} />
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
