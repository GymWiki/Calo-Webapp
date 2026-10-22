import { createPublicClient } from "@/utils/supabase/public";

/**
 * Vooraf gegenereerde intro-tekst voor een categoriepagina (zie
 * supabase/migrations/categorie_intro.sql en
 * scripts/generate-category-intros.mts). Leest, net als
 * lib/services/publicActivities.ts, via de plain anon-client — schrijven
 * gebeurt uitsluitend via het script (service-role, buiten de app om).
 * Geeft `null` terug als er nog geen intro is gegenereerd voor deze
 * categorie — de aanroepende pagina laat de introsectie dan gewoon weg
 * i.p.v. een kale placeholder te tonen.
 */
export async function getCategoryIntro(
  type: "leerlijn" | "groep",
  slug: string,
): Promise<string | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categorie_intro")
    .select("intro_text")
    .eq("type", type)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Kon categorie-intro niet ophalen: ${error.message}`);
  }

  return data?.intro_text ?? null;
}
