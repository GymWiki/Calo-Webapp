import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

/**
 * De volledige leerlijn_leeruitkomsten-catalogus, gegroepeerd per leerlijn —
 * één query, server-side (les-maken/page.tsx), i.p.v. een aparte round-trip
 * per leerlijn-wissel in de generator-wizard. Backt de leeruitkomst-chips in
 * app/(protected)/les-maken/ai-lesson-wizard.tsx.
 */
export async function getLeeruitkomstenByLeerlijn(): Promise<Record<string, string[]>> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from("leerlijn_leeruitkomsten")
    .select("leerlijn, leeruitkomst")
    .order("sort_order", { ascending: true });

  if (error || !data) {
    return {};
  }

  const byLeerlijn: Record<string, string[]> = {};
  for (const row of data as { leerlijn: string; leeruitkomst: string }[]) {
    (byLeerlijn[row.leerlijn] ??= []).push(row.leeruitkomst);
  }
  return byLeerlijn;
}
