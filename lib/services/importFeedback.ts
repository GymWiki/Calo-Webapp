import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

async function getServerClient() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

export type ImportFeedbackFieldSummary = {
  fieldName: string;
  editedCount: number;
  movedFromUnplacedCount: number;
  totalCount: number;
};

/**
 * Telt, per veldnaam, hoe vaak gebruikers dat veld ná een documentimport
 * hebben bewerkt of met een "Niet geplaatst"-item hebben aangevuld (zie
 * supabase/migrations/activity_import_feedback.sql en
 * actions/activityImport.ts se logImportFeedback) — zonder tekstinhoud,
 * puur telwerk. Backt /beheer/ai-import: een hoog totaal bij een veld wijst
 * op een structureel extractieprobleem, bruikbaar om probleemdocumenten aan
 * de testset (fixtures/imports) toe te voegen.
 */
export async function getImportFeedbackSummary(): Promise<ImportFeedbackFieldSummary[]> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from("activity_import_feedback")
    .select("field_name, change_type");

  if (error || !data) {
    return [];
  }

  const byField = new Map<string, { edited: number; moved: number }>();
  for (const row of data) {
    const entry = byField.get(row.field_name) ?? { edited: 0, moved: 0 };
    if (row.change_type === "edited") {
      entry.edited += 1;
    } else {
      entry.moved += 1;
    }
    byField.set(row.field_name, entry);
  }

  return [...byField.entries()]
    .map(([fieldName, { edited, moved }]) => ({
      fieldName,
      editedCount: edited,
      movedFromUnplacedCount: moved,
      totalCount: edited + moved,
    }))
    .sort((a, b) => b.totalCount - a.totalCount);
}

/** Totaal aantal voltooide imports (jobs met status='done') — geeft de
 * feedback-tellingen hierboven context (percentage i.p.v. kaal aantal). */
export async function getCompletedImportJobCount(): Promise<number> {
  const supabase = await getServerClient();
  const { count, error } = await supabase
    .from("activity_import_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "done");

  if (error || count === null) return 0;
  return count;
}
