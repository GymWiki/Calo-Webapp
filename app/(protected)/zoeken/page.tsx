import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";

import { cookies } from "next/headers";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LibraryScopeSwitcher } from "@/components/team/LibraryScopeSwitcher";
import { getUserPermissions, LIBRARY_PREVIEW_LIMIT } from "@/lib/permissions";
import { getAllActivities, getPublicActivities, getTeamActivities } from "@/lib/services/activities";
import { getOrCreateLibraryPreviewActivityIds } from "@/lib/services/libraryPreview";
import { getTeamMembers } from "@/lib/services/teams";
import { getTeamLibraryItemsByActivity, getTeamTags } from "@/lib/services/teamLibrary";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { createClient } from "@/utils/supabase/server";
import type { UserProfile } from "@/lib/types";
import { LibrarySearchClient } from "./library-search-client";

export default async function ZoekenPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const { hasFullLibraryAccess } = getUserPermissions(profile);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 xl:max-w-[1400px]">
      <PageHeader
        eyebrow="Bibliotheek"
        title="Ontdek activiteiten"
        description="GymWiki-activiteiten uit de gezamenlijke bibliotheek en publiek gedeelde activiteiten, in één doorzoekbaar overzicht."
      />

      {!hasFullLibraryAccess && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-4">
            <Lock className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="text-sm">
              Je hebt de maandelijkse bijdrage-eis niet gehaald: dezelfde {LIBRARY_PREVIEW_LIMIT}{" "}
              activiteiten blijven voor jou vrij toegankelijk, ongeacht welke filters of zoektermen
              je toepast — de rest van de bibliotheek zie je vervaagd, met een slotje. Draag deze
              maand een nieuwe activiteit bij of neem het betaalde abonnement voor volledige
              toegang.
            </p>
          </CardContent>
        </Card>
      )}

      <Suspense fallback={<Skeleton className="h-11 w-full rounded-md" />}>
        <ZoekenContent profile={profile} hasFullLibraryAccess={hasFullLibraryAccess} />
      </Suspense>
    </main>
  );
}

async function ZoekenContent({
  profile,
  hasFullLibraryAccess,
}: {
  profile: UserProfile;
  hasFullLibraryAccess: boolean;
}) {
  // Preview-slot (zie de brief): een free_blocked-gebruiker krijgt dezelfde
  // volledige, doorzoekbare dataset als iedereen — de beperking zit niet in
  // wélke rijen worden opgehaald, maar in welke kaarten LibrarySearchClient
  // als "vrij" i.p.v. vervaagd/vergrendeld rendert, en in de blokkade bij
  // het openen van een activiteit (zie activiteit/[id]/page.tsx). Dat is
  // bewust: het "kijk wat je mist"-effect vereist dat de echte omvang van
  // de bibliotheek zichtbaar blijft, niet een vooraf al ingekorte dataset.
  const [allActivities, publicActivities] = await Promise.all([
    getAllActivities(),
    getPublicActivities(),
  ]);

  // getAllActivities() geeft ALLE goedgekeurde+publieke activiteiten terug
  // (de basisbibliotheek ÉN door gebruikers gedeelde activiteiten) — de
  // "GymWiki"-bron-tab/badge hoort alleen bij de oorspronkelijke
  // basisbibliotheek (author_id null). Zonder dit filter zou een door een
  // gebruiker gedeelde activiteit hier dubbel én verkeerd gelabeld ("GymWiki"
  // i.p.v. "Publiek") verschijnen — 'm zit al correct in publicActivities
  // hieronder (zie getPublicActivities's eigen author_id-not-null-filter).
  const activities = allActivities.filter((activity) => activity.author_id === null);

  // Vaste preview-set (zie lib/services/libraryPreview.ts): eenmalig
  // berekend en op het profiel opgeslagen bij het eerste bezoek van een
  // free_blocked-gebruiker, zodat filteren niet steeds een NIEUWE N
  // oplevert — dat was precies de omzeiling die deze wijziging moest
  // dichten.
  const previewActivityIds = hasFullLibraryAccess
    ? null
    : await getOrCreateLibraryPreviewActivityIds(
        profile.id,
        profile.library_preview_activity_ids,
        [...new Set([...activities, ...publicActivities].map((activity) => activity.id))],
      );

  // Teambibliotheek-scope-wisselaar — alleen voor leden van een actief team
  // (subscription_status is hier de EFFECTIEVE status, zie get_effective_access,
  // team_plans.sql). Niet-leden zien de wisselaar niet, zie de brief.
  const hasActiveTeam = profile.team_id !== null && profile.subscription_status === "paid_subscriber";

  // Lid van een team, maar het team is opgezegd/coulance verlopen: geen
  // teambibliotheek-inhoud tonen (de leakage-eis geldt ook hier), wél een
  // duidelijke melding i.p.v. de wisselaar stilletjes te laten verdwijnen —
  // zie de brief, sectie 7 ("canceled/expired team: toon melding, geen
  // inhoud"). De teambibliotheek zelf blijft bewaard (TEAM_LIBRARY_RETENTION_DAYS,
  // lib/constants/subscriptionPlans.ts) — bij heractivering (actions/team.ts)
  // is alles direct weer terug.
  if (profile.team_id !== null && !hasActiveTeam) {
    return (
      <>
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-4 text-sm">
            De teambibliotheek van {profile.team_name ?? "je team"} is momenteel niet beschikbaar — het
            teamabonnement is opgezegd of de betaling loopt achter. Vraag de teameigenaar om het abonnement
            te heractiveren; alle teamactiviteiten en -tags blijven ondertussen bewaard.
          </CardContent>
        </Card>
        <LibrarySearchClient
          activities={activities}
          publicActivities={publicActivities}
          previewActivityIds={previewActivityIds}
          currentUserId={profile.id}
        />
      </>
    );
  }

  if (hasActiveTeam && profile.team_id) {
    const supabase = createClient(await cookies());
    const [teamActivities, itemsByActivity, allTeamTags, teamMembers] = await Promise.all([
      getTeamActivities(profile.team_id),
      getTeamLibraryItemsByActivity(supabase, profile.team_id),
      getTeamTags(supabase, profile.team_id),
      getTeamMembers(supabase, profile.team_id),
    ]);

    const teamEntries = teamActivities
      .map((activity) => {
        const item = itemsByActivity.get(activity.id);
        return item ? { activity, item } : null;
      })
      .filter((entry) => entry !== null);

    return (
      <LibraryScopeSwitcher
        activities={activities}
        publicActivities={publicActivities}
        previewActivityIds={previewActivityIds}
        currentUserId={profile.id}
        teamName={profile.team_name ?? "Team"}
        teamEntries={teamEntries}
        allTeamTags={allTeamTags}
        teamMembers={teamMembers.map((member) => ({
          userId: member.user_id,
          name: `${member.first_name} ${member.last_name}`.trim(),
        }))}
      />
    );
  }

  return (
    <LibrarySearchClient
      activities={activities}
      publicActivities={publicActivities}
      previewActivityIds={previewActivityIds}
      currentUserId={profile.id}
    />
  );
}
