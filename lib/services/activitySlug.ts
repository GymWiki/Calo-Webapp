import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_SLUG_LENGTH = 80;

/**
 * Puur functioneel: titel -> kebab-case slug-basis (nog niet uniek
 * gemaakt). Diakrieten strippen i.p.v. laten staan — anders wint de
 * variant zonder accenten (bijv. "tikspel") de facto altijd de zoekterm,
 * en URL's met accenten zijn onhandig te delen/typen.
 */
export function slugifyTitle(titel: string): string {
  const base = titel
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return base || "activiteit";
}

/**
 * Zoekt een unieke slug: probeert de kale titel-slug eerst, telt anders
 * -2/-3/... op tot een vrij nummer. `excludeId` sluit de eigen rij uit bij
 * een update (anders zou een activiteit altijd tegen zijn eigen slug
 * botsen).
 */
export async function generateUniqueSlug(
  supabase: SupabaseClient,
  titel: string,
  excludeId: string | null,
): Promise<string> {
  const base = slugifyTitle(titel);
  let candidate = base;
  let suffix = 2;

  for (;;) {
    let query = supabase.from("activiteiten").select("id").eq("slug", candidate).limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

/**
 * Levert de te gebruiken slug voor een activiteit die net (opnieuw)
 * goedgekeurd is: een bestaande slug blijft ALTIJD staan, ook als de titel
 * intussen wijzigde — een eenmaal geïndexeerde/gedeelde
 * /activiteiten/[slug]-URL mag nooit onder je vandaan breken. Alleen een
 * rij die nog geen slug heeft (eerste keer publiek) krijgt er hier één.
 */
export async function resolveSlug(
  supabase: SupabaseClient,
  activityId: string | null,
  titel: string,
): Promise<string> {
  if (activityId) {
    const { data } = await supabase
      .from("activiteiten")
      .select("slug")
      .eq("id", activityId)
      .maybeSingle();
    if (data?.slug) return data.slug;
  }

  return generateUniqueSlug(supabase, titel, activityId);
}
