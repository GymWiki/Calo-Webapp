"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { LibrarySearchClient } from "@/app/(protected)/zoeken/library-search-client";
import { TeamLibraryClient } from "@/components/team/TeamLibraryClient";
import { cn } from "@/lib/utils";
import type { Activity } from "@/types/activity";
import type { TeamLibraryItem, TeamTag } from "@/types/teamLibrary";

/**
 * Scope-wisselaar bovenaan de Bibliotheek-pagina — alleen zichtbaar voor
 * leden van een actief team (zie zoeken/page.tsx). "scope" staat in de URL
 * (net als de teambibliotheek's eigen filters, zie TeamLibraryClient) zodat
 * een gedeelde link ook de gekozen scope meeneemt.
 */
export function LibraryScopeSwitcher({
  activities,
  publicActivities,
  previewActivityIds,
  currentUserId,
  teamName,
  teamEntries,
  allTeamTags,
  teamMembers,
}: {
  activities: Activity[];
  publicActivities: Activity[];
  previewActivityIds: string[] | null;
  currentUserId: string;
  teamName: string;
  teamEntries: { activity: Activity; item: TeamLibraryItem }[];
  allTeamTags: TeamTag[];
  teamMembers: { userId: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope") === "team" ? "team" : "shared";

  function selectScope(next: "shared" | "team") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "shared") {
      params.delete("scope");
    } else {
      params.set("scope", "team");
    }
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div className="flex overflow-hidden rounded-md border w-fit max-w-full">
        <button
          type="button"
          onClick={() => selectScope("shared")}
          className={cn(
            "min-h-9 px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors duration-150 ease-brand",
            scope === "shared" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
          )}
        >
          Gedeelde bibliotheek
        </button>
        <button
          type="button"
          onClick={() => selectScope("team")}
          className={cn(
            "min-h-9 border-l px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors duration-150 ease-brand",
            scope === "team" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
          )}
        >
          Teambibliotheek ({teamName})
        </button>
      </div>

      {scope === "team" ? (
        <TeamLibraryClient teamName={teamName} entries={teamEntries} allTeamTags={allTeamTags} members={teamMembers} />
      ) : (
        <LibrarySearchClient
          activities={activities}
          publicActivities={publicActivities}
          previewActivityIds={previewActivityIds}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
