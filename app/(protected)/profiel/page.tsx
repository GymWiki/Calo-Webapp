import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { CommunityStatsCard } from "@/components/profile/CommunityStatsCard";
import { FreemiumStatusCard } from "@/components/profile/FreemiumStatusCard";
import { KnowledgeBaseSummaryCard } from "@/components/profile/KnowledgeBaseSummaryCard";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileNavGrid } from "@/components/profile/ProfileNavGrid";
import { getCommunityStats } from "@/lib/services/community-stats";
import { getContributionStatus } from "@/lib/services/contribution";
import {
  getActivityDrafts,
  getOwnSubmissions,
  getSavedActivityIds,
} from "@/lib/services/activities";
import { getAllKnowledgeDocuments } from "@/lib/services/knowledge";
import { getUserLessons } from "@/lib/services/lessons";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { createClient } from "@/utils/supabase/server";

export default async function ProfielPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const [
    contributionStatus,
    ownSubmissions,
    savedIds,
    lessons,
    drafts,
    knowledgeDocuments,
    communityStats,
  ] = await Promise.all([
    getContributionStatus(supabase, profile.id, profile.subscription_status),
    getOwnSubmissions(profile.id),
    getSavedActivityIds(profile.id),
    getUserLessons(profile.id),
    getActivityDrafts(profile.id),
    getAllKnowledgeDocuments(),
    getCommunityStats(profile.id),
  ]);

  const processedDocuments = knowledgeDocuments.filter(
    (document) => document.status === "processed",
  ).length;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Profiel"
        title="Jouw GymWiki-hub"
        description="Alles wat bij jouw account hoort, op één plek."
      />

      <ProfileHeader profile={profile} />

      <FreemiumStatusCard
        status={contributionStatus}
        subscriptionStatus={profile.subscription_status}
      />

      <ProfileNavGrid
        activitiesCount={ownSubmissions.length}
        savedCount={savedIds.size}
        lessonsCount={lessons.length}
        draftsCount={drafts.length}
      />

      <KnowledgeBaseSummaryCard
        totalCount={knowledgeDocuments.length}
        processedCount={processedDocuments}
      />

      <CommunityStatsCard stats={communityStats} />
    </main>
  );
}
