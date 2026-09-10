import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

async function getServerClient() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

export type CommunityStats = {
  sharedActivitiesCount: number;
  reuseCount: number;
};

/**
 * Lichte statistieken voor de profielpagina — bewust zonder badges/
 * gamification (die zijn eerder deze sessie al uit de refactor gehaald).
 * Er bestaat geen "bekeken"-teller in de database; "hergebruikt" is dus een
 * proxy via hoe vaak anderen een van jouw goedgekeurde activiteiten hebben
 * opgeslagen (get_own_activity_reuse_count, nodig omdat de gewone
 * RLS-gebonden client andermans opslag-rijen niet mag zien).
 */
export async function getCommunityStats(userId: string): Promise<CommunityStats> {
  const supabase = await getServerClient();

  const [{ count: sharedActivitiesCount }, { data: reuseCountData }] = await Promise.all([
    supabase
      .from("activiteiten")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId)
      .eq("status", "approved"),
    supabase.rpc("get_own_activity_reuse_count"),
  ]);

  return {
    sharedActivitiesCount: sharedActivitiesCount ?? 0,
    reuseCount: typeof reuseCountData === "number" ? reuseCountData : 0,
  };
}
