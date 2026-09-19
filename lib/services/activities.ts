import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { Activity } from "@/types/activity";

const ACTIVITY_SELECT =
  "id, titel, actcode, afbeelding, beginsituatie, beschrijving, categorie, beweegthema, doel, leerlijn, loopt, lukt, leeft, niveau, materiaal, onderwijs_type, veld, regels, doelgroep, learning_outcomes, author_id, status, rejection_reason, submitted_at, created_at, " +
  "group_name, activity_date, movement_problem, min_participants, participants_bench, base_materials, rule_materials, diagram_data, diagram_image_url, game_category, game_dimensions, tactical_questions, didactic_items, arrangement, deelnemers_regels, plaatje_praatje, aandachtspunten, is_ai_generated, is_public, public_since";

// Voor lijst-/kaartweergaves (bibliotheek, "Mijn activiteiten", opgeslagen,
// dashboard-secties): dezelfde velden als ACTIVITY_SELECT, MINUS de zware
// velden die uitsluitend op de detail-/editweergave gebruikt worden
// (diagram_data is de volledige canvas-plattegrond-JSON, didactic_items/
// tactical_questions/deelnemers_regels/plaatje_praatje/aandachtspunten/
// movement_problem/game_category/game_dimensions/is_ai_generated zijn
// detail-only vrije tekst/metadata). Geverifieerd met een repo-brede grep
// dat geen van deze velden ergens in een kaart- of zoek/filter-component
// wordt gebruikt (o.a. library-search-client.tsx, library-item-card.tsx,
// my-activity-card.tsx, recent-activities-list.tsx, community-lessons-
// section.tsx) — voeg een veld hier terug toe zodra een lijstweergave het
// nodig heeft. Het resultaat wordt nog steeds als `Activity[]` getypeerd
// (geen apart, smaller type) — dat is een bewuste, gedocumenteerde
// afweging: TypeScript kan een toekomstig gebruik van een hier weggelaten
// veld dus niet zelf afvangen, alleen deze lijst met opmerking.
const ACTIVITY_LIST_SELECT =
  "id, titel, actcode, afbeelding, beginsituatie, beschrijving, categorie, beweegthema, doel, leerlijn, loopt, lukt, leeft, niveau, materiaal, onderwijs_type, veld, regels, doelgroep, learning_outcomes, author_id, status, rejection_reason, submitted_at, created_at, " +
  "group_name, activity_date, min_participants, participants_bench, base_materials, rule_materials, diagram_image_url, arrangement, is_public, public_since";

async function getServerClient() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

/**
 * De gedeelde, doorzoekbare bibliotheek — alleen goedgekeurde, publiek
 * gedeelde activiteiten. Wordt voor ELKE gebruiker volledig opgehaald,
 * ongeacht toegangsniveau: het preview-slot voor free_blocked-gebruikers
 * (bijdrage-eis niet gehaald, zie lib/permissions.ts's hasFullLibraryAccess
 * en LIBRARY_PREVIEW_LIMIT) beperkt hoeveel kaarten LibrarySearchClient
 * ervan RENDERT, niet welke rijen hier worden opgehaald — de daadwerkelijke
 * inhoud-blokkade zit op /activiteit/[id] zelf.
 *

 * `is_public=true` is hier bewust expliciet toegevoegd (naast
 * `status='approved'`): sinds de "Delen in de gedeelde bibliotheek"-toggle
 * (zie actions/lesson.ts's createLesson) kan een eigen activiteit
 * goedgekeurd-maar-privé zijn — RLS voorkomt al dat zo'n rij van EEN ANDERE
 * gebruiker hier binnenkomt (zie consolidate_lessons_into_activiteiten.sql),
 * maar zonder deze filter zou een eigen privé-activiteit toch in de eigen
 * "gedeelde bibliotheek"-weergave verschijnen, wat de toggle zou tegenspreken.
 */
export async function getAllActivities(): Promise<Activity[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("activiteiten")
    .select(ACTIVITY_LIST_SELECT)
    .eq("status", "approved")
    .eq("is_public", true)
    .order("titel", { ascending: true })
    .returns<Activity[]>();

  if (error) {
    throw new Error(`Kon activiteiten niet ophalen: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Eigen ingediende activiteiten (pending/approved/rejected) — gebruikt voor
 * "Mijn activiteiten" en het dashboard/profiel. Sluit concepten (status
 * 'draft') bewust uit — die zijn nog niet ingediend, zie getActivityDrafts
 * hieronder.
 */
export async function getOwnSubmissions(authorId: string): Promise<Activity[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("activiteiten")
    .select(ACTIVITY_LIST_SELECT)
    .eq("author_id", authorId)
    .neq("status", "draft")
    .order("submitted_at", { ascending: false })
    .returns<Activity[]>();

  if (error) {
    throw new Error(`Kon eigen bijdragen niet ophalen: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Eigen concepten (status 'draft') — volledig ingevuld maar nog niet
 * ingediend, dus nog niet door de AI-kwaliteitscheck gegaan. Zie
 * submitActivityDraft/deleteActivityDraft in actions/activity-submission.ts.
 *
 * Sorteert op created_at (i.p.v. submitted_at, dat pas gezet wordt bij een
 * echte indiening en dus voor elk concept nog leeg is — een sortering
 * daarop was in de praktijk willekeurig) zodat meerdere naamloze concepten
 * (zie components/my-activity-card.tsx) tenminste een voorspelbare,
 * recent-eerst volgorde hebben.
 */
export async function getActivityDrafts(authorId: string): Promise<Activity[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("activiteiten")
    .select(ACTIVITY_LIST_SELECT)
    .eq("author_id", authorId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .returns<Activity[]>();

  if (error) {
    throw new Error(`Kon concepten niet ophalen: ${error.message}`);
  }

  return data ?? [];
}

export async function getActivityById(
  activityId: string,
): Promise<Activity | null> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("activiteiten")
    .select(ACTIVITY_SELECT)
    .eq("id", activityId)
    .maybeSingle()
    .returns<Activity>();

  if (error) {
    throw new Error(`Kon activiteit niet ophalen: ${error.message}`);
  }

  return data;
}

/**
 * Recent publiek gemaakte, door gebruikers ingediende activiteiten — de
 * dashboard-communitysectie en de "Publiek"-tab in /zoeken. Sluit de 203
 * oorspronkelijke bibliotheek-activiteiten uit (author_id null): die horen
 * bij de "GymWiki"-bron, niet bij "door medestudenten gedeeld", ook al zijn
 * ze sinds de datamodel-consolidatie ook is_public=true.
 */
export async function getPublicActivities(): Promise<Activity[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("activiteiten")
    .select(ACTIVITY_LIST_SELECT)
    .eq("is_public", true)
    .not("author_id", "is", null)
    .order("public_since", { ascending: false })
    .returns<Activity[]>();

  if (error) {
    throw new Error(`Kon publieke activiteiten niet ophalen: ${error.message}`);
  }

  return data ?? [];
}

export async function isActivitySaved(
  userId: string,
  activityId: string,
): Promise<boolean> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("opgeslagen_activiteiten")
    .select("id")
    .eq("user_id", userId)
    .eq("activiteit_id", activityId)
    .maybeSingle();

  if (error) {
    throw new Error(`Kon opgeslagen status niet ophalen: ${error.message}`);
  }

  return data !== null;
}

export async function getSavedActivityIds(
  userId: string,
): Promise<Set<string>> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("opgeslagen_activiteiten")
    .select("activiteit_id")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Kon opgeslagen activiteiten niet ophalen: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => row.activiteit_id));
}

/**
 * Volledige, opgeslagen-favorieten-lijst voor de profielpagina — meest
 * recent opgeslagen eerst. Twee stappen (i.p.v. een embedded select) zodat
 * de save-volgorde expliciet bewaard blijft ondanks Postgres' `in()` geen
 * volgorde garandeert.
 */
export async function getSavedActivities(userId: string): Promise<Activity[]> {
  const supabase = await getServerClient();

  const { data: saved, error: savedError } = await supabase
    .from("opgeslagen_activiteiten")
    .select("activiteit_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (savedError) {
    throw new Error(`Kon opgeslagen activiteiten niet ophalen: ${savedError.message}`);
  }

  const orderedIds = (saved ?? []).map((row) => row.activiteit_id);
  if (orderedIds.length === 0) return [];

  const { data: activities, error } = await supabase
    .from("activiteiten")
    .select(ACTIVITY_LIST_SELECT)
    .in("id", orderedIds)
    .returns<Activity[]>();

  if (error) {
    throw new Error(`Kon opgeslagen activiteiten niet ophalen: ${error.message}`);
  }

  const byId = new Map((activities ?? []).map((activity) => [activity.id, activity]));
  return orderedIds
    .map((id) => byId.get(id))
    .filter((activity): activity is Activity => activity !== undefined);
}
