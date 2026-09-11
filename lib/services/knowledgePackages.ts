import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type {
  KnowledgePackage,
  KnowledgePackageWithDocuments,
  KnowledgePackageWithPreference,
} from "@/types/knowledgePackages";

async function getServerClient() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

/**
 * Actieve pakketten + de voorkeur van déze gebruiker (of, bij geen expliciete
 * voorkeur, het pakket se default_enabled) — backt de "Standaardbibliotheek"-
 * tab op /kennisbank.
 */
export async function getActivePackagesWithPreferences(
  userId: string,
): Promise<KnowledgePackageWithPreference[]> {
  const supabase = await getServerClient();

  const { data: packages } = await supabase
    .from("knowledge_packages")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (!packages || packages.length === 0) return [];

  const { data: preferences } = await supabase
    .from("user_knowledge_preferences")
    .select("package_id, enabled")
    .eq("user_id", userId);

  const enabledById = new Map(
    (preferences ?? []).map((preference) => [preference.package_id as string, preference.enabled as boolean]),
  );

  return (packages as KnowledgePackage[]).map((pkg) => ({
    ...pkg,
    enabled: enabledById.get(pkg.id) ?? pkg.default_enabled,
  }));
}

/**
 * Totaal aantal beschikbare AI-kennisbronnen voor déze gebruiker: de
 * gedeelde, verwerkte knowledge_base (altijd meegenomen, zie
 * knowledge_base_simplify.sql) + de verwerkte documenten van elk actief
 * pakket dat de gebruiker heeft aangevinkt (of default_enabled zonder
 * expliciete voorkeur). Gebruikt zowel voor de "AI baseert zich op N
 * bronnen"-hint (KnowledgeSourceHint) als voor de harde 0-bronnen-blokkade
 * in lib/ai/knowledgeRetrieval.ts (Stap 8).
 */
export async function getAvailableSourceCount(userId: string): Promise<number> {
  const supabase = await getServerClient();

  const [{ count: baseCount }, { data: packages }] = await Promise.all([
    supabase
      .from("knowledge_base")
      .select("id", { count: "exact", head: true })
      .eq("status", "processed"),
    supabase.from("knowledge_packages").select("id, default_enabled").eq("is_active", true),
  ]);

  if (!packages || packages.length === 0) {
    return baseCount ?? 0;
  }

  const { data: preferences } = await supabase
    .from("user_knowledge_preferences")
    .select("package_id, enabled")
    .eq("user_id", userId);

  const enabledById = new Map(
    (preferences ?? []).map((preference) => [preference.package_id as string, preference.enabled as boolean]),
  );

  const enabledPackageIds = (packages as { id: string; default_enabled: boolean }[])
    .filter((pkg) => enabledById.get(pkg.id) ?? pkg.default_enabled)
    .map((pkg) => pkg.id);

  if (enabledPackageIds.length === 0) {
    return baseCount ?? 0;
  }

  const { count: packageDocCount } = await supabase
    .from("knowledge_package_documents")
    .select("id", { count: "exact", head: true })
    .eq("processing_status", "processed")
    .in("package_id", enabledPackageIds);

  return (baseCount ?? 0) + (packageDocCount ?? 0);
}

/**
 * Volledig admin-overzicht: alle pakketten (ook inactieve) met hun
 * documenten + verwerkingsstatus. Toegang wordt op paginaniveau afgedwongen
 * (lib/adminAccess.ts) — RLS (is_library_admin()) is de echte handhaving
 * mocht deze functie ooit ergens anders aangeroepen worden.
 */
export async function getAllPackagesWithDocuments(): Promise<KnowledgePackageWithDocuments[]> {
  const supabase = await getServerClient();

  const { data: packages } = await supabase
    .from("knowledge_packages")
    .select("*")
    .order("created_at", { ascending: false });

  if (!packages || packages.length === 0) return [];

  const { data: documents } = await supabase
    .from("knowledge_package_documents")
    .select("*")
    .order("created_at", { ascending: false });

  return (packages as KnowledgePackage[]).map((pkg) => ({
    ...pkg,
    documents: (documents ?? []).filter((document) => document.package_id === pkg.id),
  }));
}
