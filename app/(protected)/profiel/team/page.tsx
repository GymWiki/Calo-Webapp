import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { PageHeader } from "@/components/page-header";
import { TeamOwnerDashboard } from "@/components/team/TeamOwnerDashboard";
import { TeamMemberView } from "@/components/team/TeamMemberView";
import { TeamPlanPicker } from "@/components/team/TeamPlanPicker";
import { TEAM_AI_LESCOACH_PER_SEAT_LIMIT } from "@/lib/constants/subscriptionPlans";
import { getSeatUsage, getTeamAiUsage, getTeamInvites, getTeamMembers, getMyTeam } from "@/lib/services/teams";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import type { Team } from "@/types/team";

/**
 * Beheerderspagina (Profiel → Team) — zichtbaar voor iedereen, drie states:
 * geen team (TeamPlanPicker), eigenaar (TeamOwnerDashboard), lid
 * (TeamMemberView). Eén team per gebruiker (zie
 * supabase/migrations/team_plans.sql), dus getMyTeam geeft hoogstens één
 * resultaat terug.
 */
export default async function TeamPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const myTeam = await getMyTeam(supabase, profile.id);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Profiel"
        title="Team"
        description="Eén beheerder betaalt een jaarlijks teampakket op factuur en nodigt collega's uit — zij krijgen daarmee dezelfde volledige toegang als een betalend account, zonder zelf te betalen."
      />

      {!myTeam ? (
        <TeamPlanPicker />
      ) : myTeam.role === "owner" ? (
        <OwnerDashboardData teamId={myTeam.team.id} team={myTeam.team} />
      ) : (
        <MemberViewData team={myTeam.team} />
      )}
    </main>
  );
}

async function OwnerDashboardData({ teamId, team }: { teamId: string; team: Team }) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const [members, invites, seatUsage, aiUsage] = await Promise.all([
    getTeamMembers(supabase, teamId),
    getTeamInvites(supabase, teamId),
    getSeatUsage(supabase, teamId),
    getTeamAiUsage(supabase, teamId, team.seat_limit, TEAM_AI_LESCOACH_PER_SEAT_LIMIT),
  ]);

  return (
    <TeamOwnerDashboard team={team} members={members} invites={invites} seatUsage={seatUsage} aiUsage={aiUsage} />
  );
}

async function MemberViewData({ team }: { team: Team }) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: owner } = await supabase
    .from("users")
    .select("first_name, last_name")
    .eq("id", team.owner_user_id)
    .maybeSingle();

  return (
    <TeamMemberView
      team={team}
      ownerName={owner ? `${owner.first_name} ${owner.last_name}`.trim() : "de teameigenaar"}
    />
  );
}
