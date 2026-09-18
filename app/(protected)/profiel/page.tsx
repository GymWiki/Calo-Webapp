import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { CommunityStatsCard } from "@/components/profile/CommunityStatsCard";
import { FreemiumStatusCard } from "@/components/profile/FreemiumStatusCard";
import { KnowledgeBaseSummaryCard } from "@/components/profile/KnowledgeBaseSummaryCard";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileNavGrid } from "@/components/profile/ProfileNavGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { getCommunityStats } from "@/lib/services/community-stats";
import { getContributionStatus } from "@/lib/services/contribution";
import {
  getActivityDrafts,
  getOwnSubmissions,
  getSavedActivityIds,
} from "@/lib/services/activities";
import { getAllKnowledgeDocuments } from "@/lib/services/knowledge";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { createClient } from "@/utils/supabase/server";
import type { UserProfile } from "@/lib/types";

// Voorheen ÉÉN grote Promise.all met alle 6 queries vóór alle JSX — dat
// betekende dat de hele pagina (incl. ProfileHeader, die alleen `profile`
// nodig heeft) wachtte op de traagste van de zes. Elke kaart hieronder
// heeft nu zijn eigen Suspense-boundary met een eigen, onafhankelijke
// databron, zodat ProfileHeader instant rendert en elke kaart verschijnt
// zodra ZIJN data binnen is — zie CLAUDE.md/de brief over per-sectie laden.
export default async function ProfielPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-6xl">
      <PageHeader
        eyebrow="Profiel"
        title="Jouw GymWiki-hub"
        description="Alles wat bij jouw account hoort, op één plek."
      />

      <ProfileHeader profile={profile} />

      <Suspense fallback={<Skeleton className="h-20 w-full rounded-2xl" />}>
        <FreemiumStatusSection profile={profile} />
      </Suspense>

      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        }
      >
        <ProfileNavSection userId={profile.id} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-20 w-full rounded-2xl" />}>
        <KnowledgeBaseSection />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-32 w-full rounded-2xl" />}>
        <CommunityStatsSection userId={profile.id} />
      </Suspense>
    </main>
  );
}

async function FreemiumStatusSection({ profile }: { profile: UserProfile }) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const contributionStatus = await getContributionStatus(
    supabase,
    profile.id,
    profile.subscription_status,
  );

  return (
    <FreemiumStatusCard status={contributionStatus} subscriptionStatus={profile.subscription_status} />
  );
}

async function ProfileNavSection({ userId }: { userId: string }) {
  const [ownSubmissions, drafts, savedIds] = await Promise.all([
    getOwnSubmissions(userId),
    getActivityDrafts(userId),
    getSavedActivityIds(userId),
  ]);

  return (
    <ProfileNavGrid
      activitiesCount={ownSubmissions.length + drafts.length}
      savedCount={savedIds.size}
    />
  );
}

async function KnowledgeBaseSection() {
  const knowledgeDocuments = await getAllKnowledgeDocuments();
  const processedDocuments = knowledgeDocuments.filter(
    (document) => document.status === "processed",
  ).length;

  return (
    <KnowledgeBaseSummaryCard
      totalCount={knowledgeDocuments.length}
      processedCount={processedDocuments}
    />
  );
}

async function CommunityStatsSection({ userId }: { userId: string }) {
  const communityStats = await getCommunityStats(userId);
  return <CommunityStatsCard stats={communityStats} />;
}
