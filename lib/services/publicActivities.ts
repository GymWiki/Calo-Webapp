import { createPublicClient } from "@/utils/supabase/public";
import { slugifyTitle } from "@/lib/services/activitySlug";
import { DOELGROEP_SLUGS } from "@/types/activity";

/**
 * Rijvorm van public.activiteiten_publiek (zie
 * supabase/migrations/activiteiten_public_seo.sql) — een harde kolom-
 * allowlist, dus dit type is EXACT wat de view teruggeeft, niet een subset
 * van het bredere `Activity`-type. De view zelf dwingt ook de
 * indexeerbaarheidsregel af (approved + is_public + niet-AI-gegenereerd +
 * geslaagde seo_summary) — elke rij die deze functies teruggeven is dus per
 * definitie publiceerbaar, zonder dat de aanroeper dat zelf hoeft te
 * controleren.
 */
export type PublicActivity = {
  id: string;
  slug: string;
  titel: string;
  seo_summary: string;
  doel: string | null;
  doelgroep: number[] | null;
  leerlijn: string | null;
  categorie: string | null;
  materiaal: string[] | null;
  base_materials: string[] | null;
  rule_materials: string[] | null;
  afbeelding: string | null;
  public_since: string | null;
  created_at: string;
};

const PUBLIC_SELECT =
  "id, slug, titel, seo_summary, doel, doelgroep, leerlijn, categorie, materiaal, base_materials, rule_materials, afbeelding, public_since, created_at";

// Plain anon-key-client (geen cookies, zie utils/supabase/public.ts) i.p.v.
// de service-role-client: geen enkele van onderstaande functies heeft ooit
// meer nodig dan wat de view toont; een service-role-client zou dat
// contract juist verzwakken (RLS/grants dan niet meer de enige grens).

/** Alle materialen van een activiteit, samengevoegd — `materiaal` is gevuld
 * voor de eenvoudige-activiteit-vorm, `base_materials`/`rule_materials` voor
 * wizard-activiteiten; nooit allebei tegelijk. */
export function getPublicMaterials(activity: PublicActivity): string[] {
  return [
    ...(activity.materiaal ?? []),
    ...(activity.base_materials ?? []),
    ...(activity.rule_materials ?? []),
  ];
}

export function getGroepSlug(code: number): string | null {
  return DOELGROEP_SLUGS[code] ?? null;
}

export function getGroepCodeFromSlug(slug: string): number | null {
  const entry = Object.entries(DOELGROEP_SLUGS).find(([, value]) => value === slug);
  return entry ? Number(entry[0]) : null;
}

export function getLeerlijnSlug(leerlijn: string): string {
  return slugifyTitle(leerlijn);
}

export async function getPublicActivityBySlug(slug: string): Promise<PublicActivity | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("activiteiten_publiek")
    .select(PUBLIC_SELECT)
    .eq("slug", slug)
    .maybeSingle()
    .returns<PublicActivity>();

  if (error) {
    throw new Error(`Kon publieke activiteit niet ophalen: ${error.message}`);
  }

  return data;
}

/**
 * Alle indexeerbare activiteiten — voedt de categoriepagina's
 * (/leerlijn/[leerlijn], /groep/[groep]), de "Gerelateerde activiteiten"-
 * sectie en de sitemap. Eén enkele, ongepagineerde fetch: de bibliotheek is
 * (nog) klein genoeg (~200 rijen) dat dit ruim binnen een normale
 * response-tijd blijft, net als lib/services/activities.ts's
 * getAllActivities(); pagineren zodra dat niet meer zo is.
 */
export async function getAllPublicActivities(): Promise<PublicActivity[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("activiteiten_publiek")
    .select(PUBLIC_SELECT)
    .order("titel", { ascending: true })
    .returns<PublicActivity[]>();

  if (error) {
    throw new Error(`Kon publieke activiteiten niet ophalen: ${error.message}`);
  }

  return data ?? [];
}

export async function getPublicActivitiesByLeerlijn(leerlijnSlug: string): Promise<PublicActivity[]> {
  const all = await getAllPublicActivities();
  return all.filter((activity) => activity.leerlijn && getLeerlijnSlug(activity.leerlijn) === leerlijnSlug);
}

export async function getPublicActivitiesByGroep(code: number): Promise<PublicActivity[]> {
  const all = await getAllPublicActivities();
  return all.filter((activity) => activity.doelgroep?.includes(code));
}

/** Combinatiepagina /leerlijn/[leerlijn]/[groep] — zie STAP 6 van de brief:
 * alleen gerenderd wanneer de aanroeper (de pagina zelf) minstens 5
 * resultaten telt. Dat minimum wordt hier bewust NIET afgedwongen — deze
 * functie geeft gewoon terug wat er is, de pagina beslist of dat genoeg is. */
export async function getPublicActivitiesByLeerlijnAndGroep(
  leerlijnSlug: string,
  code: number,
): Promise<PublicActivity[]> {
  const all = await getAllPublicActivities();
  return all.filter(
    (activity) =>
      activity.leerlijn &&
      getLeerlijnSlug(activity.leerlijn) === leerlijnSlug &&
      activity.doelgroep?.includes(code),
  );
}

/** Zelfde leerlijn of overlappende doelgroep, activiteit zelf uitgesloten —
 * gebruikt voor de "Gerelateerde activiteiten"-sectie op de detailpagina
 * (interne links, zie de brief). */
export async function getRelatedPublicActivities(
  activity: PublicActivity,
  limit = 4,
): Promise<PublicActivity[]> {
  const all = await getAllPublicActivities();
  return all
    .filter((other) => other.id !== activity.id)
    .filter(
      (other) =>
        (activity.leerlijn && other.leerlijn === activity.leerlijn) ||
        other.doelgroep?.some((code) => activity.doelgroep?.includes(code)),
    )
    .slice(0, limit);
}
