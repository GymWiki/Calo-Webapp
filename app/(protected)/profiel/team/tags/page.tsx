import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/BackButton";
import { TagsManager } from "@/components/team/TagsManager";
import { getMyTeam } from "@/lib/services/teams";
import { getTeamTagsWithCounts } from "@/lib/services/teamLibrary";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function TeamTagsPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const myTeam = await getMyTeam(supabase, profile.id);

  if (!myTeam) {
    redirect("/profiel/team");
  }

  const tags = await getTeamTagsWithCounts(supabase, myTeam.team.id);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <BackButton fallbackHref="/profiel/team" fallbackLabel="Team" />
      <PageHeader
        eyebrow="Profiel → Team"
        title="Tags beheren"
        description={`Tags voor de teambibliotheek van ${myTeam.team.name} — alle leden mogen tags aanmaken en toewijzen, ${myTeam.role === "owner" ? "jij kunt ze als eigenaar ook hernoemen, samenvoegen en verwijderen." : "hernoemen/samenvoegen/verwijderen kan alleen de teameigenaar."}`}
      />
      <TagsManager tags={tags} isOwner={myTeam.role === "owner"} />
    </main>
  );
}
