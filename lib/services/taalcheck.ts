import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { TaalcheckVoorstelStatus, TaalcheckVoorstelWithActivity } from "@/types/taalcheck";

async function getServerClient() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

/**
 * Alle voorstellen met de titel van de bijbehorende activiteit — backt het
 * review-overzicht (app/(protected)/beheer/taalcheck). Standaard alleen
 * 'pending' (waar de admin daadwerkelijk iets mee moet), maar met
 * `statuses` op te vragen voor bijv. een "eerder beoordeeld"-overzicht.
 */
export async function getTaalcheckVoorstellen(
  statuses: TaalcheckVoorstelStatus[] = ["pending"],
): Promise<TaalcheckVoorstelWithActivity[]> {
  const supabase = await getServerClient();

  const { data: voorstellen, error } = await supabase
    .from("activiteiten_taalcheck_voorstellen")
    .select("*")
    .in("status", statuses)
    .order("gegenereerd_op", { ascending: true });

  if (error) {
    throw new Error(`Kon taalcheck-voorstellen niet ophalen: ${error.message}`);
  }
  if (!voorstellen || voorstellen.length === 0) return [];

  const activiteitIds = [...new Set(voorstellen.map((v) => v.activiteit_id as string))];
  const { data: activiteiten } = await supabase
    .from("activiteiten")
    .select("id, titel")
    .in("id", activiteitIds);

  const titleById = new Map(
    (activiteiten ?? []).map((activiteit) => [activiteit.id as string, activiteit.titel as string]),
  );

  return voorstellen.map((voorstel) => ({
    ...voorstel,
    activiteit_titel: titleById.get(voorstel.activiteit_id as string) ?? "(verwijderde activiteit)",
  })) as TaalcheckVoorstelWithActivity[];
}

/**
 * Telt pending voorstellen per status — voor de tabbladtelling op het
 * review-overzicht, zonder de volledige rijen op te hoeven halen.
 */
export async function getTaalcheckVoorstelCounts(): Promise<
  Record<TaalcheckVoorstelStatus, number>
> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("activiteiten_taalcheck_voorstellen")
    .select("status");

  if (error || !data) {
    return { pending: 0, approved: 0, rejected: 0, applied: 0 };
  }

  const counts: Record<TaalcheckVoorstelStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    applied: 0,
  };
  for (const row of data) {
    const status = row.status as TaalcheckVoorstelStatus;
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}
