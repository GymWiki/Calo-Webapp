"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { checkActivityQuality, type ActivityQualityCheckInput } from "@/lib/ai/activityQualityCheck";
import { logKnowledgeUsage } from "@/lib/ai/knowledgeUsageLogging";
import { resolveSlug } from "@/lib/services/activitySlug";
import { getGroepSlug, getLeerlijnSlug } from "@/lib/services/publicActivities";
import { getMyTeam } from "@/lib/services/teams";
import {
  TEAM_LIBRARY_MAX_TAGS_PER_ITEM,
  type TeamTagColor,
  TEAM_TAG_COLORS,
} from "@/lib/constants/subscriptionPlans";
import type { Team, TeamMemberRole } from "@/types/team";
import type { TeamActivityConflict } from "@/types/teamLibrary";

type ActionResult = { error: string } | { success: true };

const GENERIC_ERROR = "Er ging iets mis. Probeer het opnieuw.";
const NOT_LOGGED_IN_ERROR = "Je bent niet ingelogd.";
const NO_TEAM_ERROR = "Je zit niet in een team.";

/**
 * Dezelfde coulance-/statuslogica als public.is_active_team_member (zie
 * supabase/migrations/team_library.sql) — bewust hier gedupliceerd zodat een
 * actie een duidelijke Nederlandse foutmelding kan geven VÓÓR de RLS-write
 * al faalt (die geeft alleen een generieke Postgres-foutmelding terug).
 */
function isTeamCurrentlyActive(team: { status: string; current_period_end: string | null }): boolean {
  if (team.status === "active") return true;
  if (team.status === "past_due" && team.current_period_end) {
    return new Date(team.current_period_end).getTime() + 14 * 24 * 60 * 60 * 1000 > Date.now();
  }
  if (team.status === "canceled" && team.current_period_end) {
    return new Date(team.current_period_end).getTime() > Date.now();
  }
  return false;
}

async function requireActiveTeam(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ error: string } | { team: Team; role: TeamMemberRole }> {
  const membership = await getMyTeam(supabase, userId);
  if (!membership) return { error: NO_TEAM_ERROR };
  if (!isTeamCurrentlyActive(membership.team)) {
    return { error: "Je teamabonnement is niet actief — de teambibliotheek is tijdelijk niet beschikbaar." };
  }
  return { team: membership.team, role: membership.role };
}

// Kolommen die de daadwerkelijke INHOUD van een activiteit vormen — gebruikt
// om (a) een kopie van een bron-activiteit te vullen en (b) een eerdere
// versie te herstellen. Bewust ZONDER id/created_at/author_id/visibility/
// team_id/version/updated_at/deleted_at/status/is_public-achtige metavelden
// — die metavelden horen NOOIT klakkeloos overschreven te worden door een
// kopie- of herstel-actie.
const CONTENT_COLUMNS = [
  "titel",
  "actcode",
  "afbeelding",
  "beginsituatie",
  "beschrijving",
  "categorie",
  "beweegthema",
  "doel",
  "leerlijn",
  "loopt",
  "lukt",
  "leeft",
  "niveau",
  "materiaal",
  "onderwijs_type",
  "veld",
  "regels",
  "doelgroep",
  "learning_outcomes",
  "group_name",
  "activity_date",
  "movement_problem",
  "min_participants",
  "participants_bench",
  "base_materials",
  "rule_materials",
  "diagram_data",
  "diagram_image_url",
  "game_category",
  "game_dimensions",
  "tactical_questions",
  "didactic_items",
  "arrangement",
  "deelnemers_regels",
  "plaatje_praatje",
  "aandachtspunten",
  "taalcode",
] as const;

function pickContentColumns(row: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of CONTENT_COLUMNS) {
    if (key in row) picked[key] = row[key];
  }
  return picked;
}

async function getUserDisplayName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from("users")
    .select("first_name, last_name")
    .eq("id", userId)
    .maybeSingle();
  return data ? `${data.first_name} ${data.last_name}`.trim() : null;
}

// ============================================================================
// Referentie / kopie vanuit de GymWiki-bibliotheek
// ============================================================================

/** "Toevoegen aan teambibliotheek" — het origineel blijft ongewijzigd/actueel. */
export async function addReferenceToTeamLibrary(activityId: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const teamResult = await requireActiveTeam(supabase, user.id);
  if ("error" in teamResult) return teamResult;

  const { error } = await supabase.from("team_library_items").insert({
    team_id: teamResult.team.id,
    activity_id: activityId,
    kind: "reference",
    added_by: user.id,
  });

  if (error) {
    return {
      error: error.message.includes("team_library_items_activity_id_team_id_key") ||
        error.message.toLowerCase().includes("duplicate")
        ? "Deze activiteit staat al in de teambibliotheek."
        : error.message.toLowerCase().includes("limiet")
          ? error.message
          : GENERIC_ERROR,
    };
  }

  revalidatePath("/zoeken");
  revalidatePath(`/activiteit/${activityId}`);
  return { success: true };
}

/** "Kopiëren naar teambibliotheek om aan te passen" — een nieuwe, vrij bewerkbare teamactiviteit. */
export async function copyToTeamLibrary(
  activityId: string,
): Promise<{ error: string } | { success: true; newActivityId: string }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const teamResult = await requireActiveTeam(supabase, user.id);
  if ("error" in teamResult) return teamResult;

  const { data: source, error: sourceError } = await supabase
    .from("activiteiten")
    .select("*")
    .eq("id", activityId)
    .maybeSingle();
  if (sourceError || !source) {
    return { error: "Bronactiviteit niet gevonden." };
  }

  const row = {
    ...pickContentColumns(source),
    author_id: user.id,
    updated_by: user.id,
    visibility: "team" as const,
    team_id: teamResult.team.id,
    source_activity_id: activityId,
    status: "approved" as const,
    is_ai_generated: false,
    in_gymwiki: false,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("activiteiten")
    .insert(row)
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { error: GENERIC_ERROR };
  }

  const { error: itemError } = await supabase.from("team_library_items").insert({
    team_id: teamResult.team.id,
    activity_id: inserted.id,
    kind: "own",
    added_by: user.id,
  });

  if (itemError) {
    // De activiteit staat er al — het teambibliotheek-item alsnog missen is
    // een ergere inconsistentie dan de gebruiker gewoon door te laten (de
    // teamactiviteit blijft via RLS gewoon bereikbaar/bewerkbaar voor het
    // team, alleen de expliciete lijst-koppeling ontbreekt dan).
    console.error("copyToTeamLibrary: team_library_items-koppeling mislukt —", itemError);
  }

  revalidatePath("/zoeken");
  return { success: true, newActivityId: inserted.id };
}

/** Verwijdert alleen de koppeling (nooit de activiteit zelf). */
export async function removeFromTeamLibrary(itemId: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { error } = await supabase.from("team_library_items").delete().eq("id", itemId);
  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/zoeken");
  return { success: true };
}

// ============================================================================
// Samen bewerken — optimistic locking + versiegeschiedenis
// ============================================================================

/**
 * Werkt een teamactiviteit bij, met optimistic locking: `expectedVersion`
 * moet de versie zijn die de bewerker LAATST zag. De archiefinsert
 * hieronder (met exact die versie als sleutel) is zelf het CAS-mechanisme —
 * zie de toelichting bij activity_versions in
 * supabase/migrations/team_library.sql: een gelijktijdige, tegenstrijdige
 * opslag met dezelfde verwachte versie botst op de unique(activity_id,
 * version)-constraint (23505), wat hier als conflict wordt behandeld.
 */
export async function updateTeamActivity(
  activityId: string,
  expectedVersion: number,
  changes: Partial<Record<(typeof CONTENT_COLUMNS)[number], unknown>>,
): Promise<{ error: string } | { success: true; version: number } | TeamActivityConflict> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { data: current, error: currentError } = await supabase
    .from("activiteiten")
    .select("*")
    .eq("id", activityId)
    .maybeSingle();
  if (currentError || !current) {
    return { error: "Activiteit niet gevonden." };
  }
  if (current.visibility !== "team") {
    return { error: "Dit is geen teamactiviteit." };
  }

  if (current.version !== expectedVersion) {
    const changedByName = await getUserDisplayName(supabase, current.updated_by ?? current.author_id);
    return { conflict: true, latestVersion: current.version, changedByName };
  }

  const { error: archiveError } = await supabase.from("activity_versions").insert({
    activity_id: activityId,
    version: current.version,
    data: current,
    changed_by: current.updated_by ?? current.author_id,
  });

  if (archiveError) {
    if (archiveError.code === "23505") {
      const { data: latest } = await supabase
        .from("activiteiten")
        .select("version, updated_by, author_id")
        .eq("id", activityId)
        .maybeSingle();
      const changedByName = await getUserDisplayName(
        supabase,
        latest?.updated_by ?? latest?.author_id ?? null,
      );
      return { conflict: true, latestVersion: latest?.version ?? current.version, changedByName };
    }
    return { error: GENERIC_ERROR };
  }

  const { data: updated, error: updateError } = await supabase
    .from("activiteiten")
    .update({
      ...changes,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
      version: current.version + 1,
    })
    .eq("id", activityId)
    .eq("version", current.version)
    .select("version")
    .maybeSingle();

  if (updateError || !updated) {
    const { data: latest } = await supabase
      .from("activiteiten")
      .select("version, updated_by, author_id")
      .eq("id", activityId)
      .maybeSingle();
    const changedByName = await getUserDisplayName(
      supabase,
      latest?.updated_by ?? latest?.author_id ?? null,
    );
    return { conflict: true, latestVersion: latest?.version ?? current.version, changedByName };
  }

  // Best-effort opruiming (de trigger doet dit ook al na elke insert
  // hierboven — dit is dus normaliter een no-op, puur een tweede vangnet).
  await supabase
    .from("activity_versions")
    .delete()
    .eq("activity_id", activityId)
    .lt("version", updated.version - 20);

  revalidatePath(`/activiteit/${activityId}`);
  revalidatePath("/zoeken");
  return { success: true, version: updated.version };
}

/** Herstelt een eerdere versie — leest de opgeslagen snapshot en slaat 'm opnieuw op via updateTeamActivity. */
export async function restoreActivityVersion(
  activityId: string,
  versionId: string,
): Promise<{ error: string } | { success: true; version: number } | TeamActivityConflict> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const [{ data: snapshot, error: snapshotError }, { data: current, error: currentError }] = await Promise.all([
    supabase.from("activity_versions").select("data").eq("id", versionId).eq("activity_id", activityId).maybeSingle(),
    supabase.from("activiteiten").select("version").eq("id", activityId).maybeSingle(),
  ]);

  if (snapshotError || !snapshot) return { error: "Deze versie bestaat niet (meer)." };
  if (currentError || !current) return { error: "Activiteit niet gevonden." };

  const restoredFields = pickContentColumns(snapshot.data as Record<string, unknown>);
  return updateTeamActivity(activityId, current.version, restoredFields);
}

/** Verwijderen mag de maker of de teameigenaar — zacht (30 dagen herstelbaar, zie de brief). */
export async function deleteTeamActivity(activityId: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { data: activity, error: fetchError } = await supabase
    .from("activiteiten")
    .select("author_id, team_id, visibility")
    .eq("id", activityId)
    .maybeSingle();
  if (fetchError || !activity || activity.visibility !== "team") {
    return { error: "Activiteit niet gevonden." };
  }

  const { data: team } = await supabase
    .from("teams")
    .select("owner_user_id")
    .eq("id", activity.team_id)
    .maybeSingle();

  const isMaker = activity.author_id === user.id;
  const isOwner = team?.owner_user_id === user.id;
  if (!isMaker && !isOwner) {
    return { error: "Alleen de maker of de teameigenaar kan deze activiteit verwijderen." };
  }

  const { error } = await supabase
    .from("activiteiten")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", activityId);
  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/zoeken");
  return { success: true };
}

// ============================================================================
// "Delen met alle GymWiki-gebruikers" — een kopie via de normale flow (met
// kwaliteitscontrole); het origineel blijft in de teambibliotheek staan.
// ============================================================================

export async function shareTeamActivityToGymWiki(
  activityId: string,
): Promise<{ error: string } | { success: true } | { success: true; rejected: true; reason: string }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { data: source, error: sourceError } = await supabase
    .from("activiteiten")
    .select("*")
    .eq("id", activityId)
    .maybeSingle();
  if (sourceError || !source) return { error: "Activiteit niet gevonden." };
  if (source.visibility !== "team") return { error: "Dit is geen teamactiviteit." };
  if (source.source_activity_id) {
    return { error: "Alleen zelf gemaakte teamactiviteiten (geen kopie van GymWiki) kunnen gedeeld worden." };
  }

  const input: ActivityQualityCheckInput = {
    titel: source.titel,
    leerlijn: source.leerlijn ?? "",
    doel: source.doel ?? "",
    beschrijving: [source.arrangement, source.deelnemers_regels, source.plaatje_praatje, source.aandachtspunten]
      .filter(Boolean)
      .join("\n\n"),
    categorie: source.beweegthema || source.leerlijn || "",
    beginsituatie: source.movement_problem ?? "",
    veld: source.arrangement ?? "",
    materiaal: [...(source.base_materials ?? []), ...(source.rule_materials ?? [])],
    regels: source.regels ?? [],
  };

  const quality = await checkActivityQuality(supabase, user.id, input);
  if (quality.status === "rejected") {
    return { success: true, rejected: true, reason: quality.reason };
  }

  const slug = await resolveSlug(supabase, null, source.titel);
  const row = {
    ...pickContentColumns(source),
    author_id: user.id,
    updated_by: user.id,
    visibility: "public" as const,
    team_id: null,
    source_activity_id: null,
    status: "approved" as const,
    is_ai_generated: false,
    in_gymwiki: false,
    public_since: new Date().toISOString(),
    seo_summary: quality.seoSummary,
    slug,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("activiteiten")
    .insert(row)
    .select("id")
    .single();
  if (insertError || !inserted) return { error: GENERIC_ERROR };

  await logKnowledgeUsage(supabase, inserted.id, "checker", quality.usedKnowledgeChunks);

  revalidatePath("/activiteiten");
  revalidatePath(`/leerlijn/${getLeerlijnSlug(source.leerlijn ?? "")}`);
  for (const code of source.doelgroep ?? []) {
    const groepSlug = getGroepSlug(code);
    if (groepSlug) revalidatePath(`/groep/${groepSlug}`);
  }

  return { success: true };
}

// ============================================================================
// Tags
// ============================================================================

function normalizeTagName(name: string): string {
  return name.trim().slice(0, 30);
}

function isValidTagColor(color: string | null | undefined): color is TeamTagColor | null {
  return color == null || (TEAM_TAG_COLORS as readonly string[]).includes(color);
}

export async function createTeamTag(
  name: string,
  color: string | null,
): Promise<{ error: string } | { success: true; tagId: string }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const teamResult = await requireActiveTeam(supabase, user.id);
  if ("error" in teamResult) return teamResult;

  const trimmed = normalizeTagName(name);
  if (trimmed.length === 0) return { error: "Vul een tagnaam in." };
  if (!isValidTagColor(color)) return { error: "Ongeldige kleur." };

  const { data, error } = await supabase
    .from("team_tags")
    .insert({ team_id: teamResult.team.id, name: trimmed, color, created_by: user.id })
    .select("id")
    .single();

  if (error) {
    return {
      error: error.code === "23505"
        ? "Deze tag bestaat al."
        : error.message.toLowerCase().includes("limiet")
          ? error.message
          : GENERIC_ERROR,
    };
  }

  revalidatePath("/zoeken");
  revalidatePath("/profiel/team/tags");
  return { success: true, tagId: data.id };
}

/** Maakt (indien nodig) een tag aan en wijst 'm meteen toe — de "typ en Enter"-flow. */
export async function createAndAssignTag(
  itemId: string,
  name: string,
): Promise<{ error: string } | { success: true; tagId: string }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { data: item } = await supabase
    .from("team_library_items")
    .select("team_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { error: "Item niet gevonden." };

  const trimmed = normalizeTagName(name);
  if (trimmed.length === 0) return { error: "Vul een tagnaam in." };

  const { data: existing } = await supabase
    .from("team_tags")
    .select("id")
    .eq("team_id", item.team_id)
    .ilike("name", trimmed)
    .maybeSingle();

  let tagId = existing?.id;
  if (!tagId) {
    const { data: created, error: createError } = await supabase
      .from("team_tags")
      .insert({ team_id: item.team_id, name: trimmed, created_by: user.id })
      .select("id")
      .single();
    if (createError || !created) {
      return {
        error: createError?.message.toLowerCase().includes("limiet") ? createError.message : GENERIC_ERROR,
      };
    }
    tagId = created.id;
  }

  const assignResult = await assignTagToItem(itemId, tagId);
  if ("error" in assignResult) return assignResult;

  return { success: true, tagId };
}

export async function assignTagToItem(itemId: string, tagId: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { error } = await supabase
    .from("team_library_item_tags")
    .insert({ item_id: itemId, tag_id: tagId, added_by: user.id });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Deze tag hangt al aan dit item."
        : error.message.toLowerCase().includes("limiet")
          ? `Max ${TEAM_LIBRARY_MAX_TAGS_PER_ITEM} tags per activiteit.`
          : GENERIC_ERROR,
    };
  }

  revalidatePath("/zoeken");
  return { success: true };
}

export async function unassignTagFromItem(itemId: string, tagId: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { error } = await supabase
    .from("team_library_item_tags")
    .delete()
    .eq("item_id", itemId)
    .eq("tag_id", tagId);
  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/zoeken");
  return { success: true };
}

/** Hernoemen — alleen de teameigenaar (RLS-afgedwongen, zie team_library.sql). */
export async function renameTeamTag(tagId: string, name: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const trimmed = normalizeTagName(name);
  if (trimmed.length === 0) return { error: "Vul een tagnaam in." };

  const { error } = await supabase.from("team_tags").update({ name: trimmed }).eq("id", tagId);
  if (error) {
    return {
      error: error.code === "23505"
        ? "Deze tagnaam bestaat al."
        : "Alleen de teameigenaar kan tags hernoemen.",
    };
  }

  revalidatePath("/profiel/team/tags");
  revalidatePath("/zoeken");
  return { success: true };
}

/** Verwijderen — alleen de teameigenaar. Cascadeert alle toewijzingen van deze tag. */
export async function deleteTeamTag(tagId: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { error } = await supabase.from("team_tags").delete().eq("id", tagId);
  if (error) return { error: "Alleen de teameigenaar kan tags verwijderen." };

  revalidatePath("/profiel/team/tags");
  revalidatePath("/zoeken");
  return { success: true };
}

/**
 * Samenvoegen — alleen de teameigenaar. Verplaatst elke toewijzing van
 * `sourceTagId` naar `targetTagId` (overslaat items die de doeltag al
 * hebben) en verwijdert daarna de brontag (cascadeert de resterende, nu
 * overbodige koppelingen).
 */
export async function mergeTeamTags(sourceTagId: string, targetTagId: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  if (sourceTagId === targetTagId) return { error: "Kies twee verschillende tags." };

  const { data: links, error: linksError } = await supabase
    .from("team_library_item_tags")
    .select("item_id")
    .eq("tag_id", sourceTagId);
  if (linksError) return { error: GENERIC_ERROR };

  if (links && links.length > 0) {
    const rows = links.map((link) => ({ item_id: link.item_id, tag_id: targetTagId, added_by: user.id }));
    const { error: upsertError } = await supabase
      .from("team_library_item_tags")
      .upsert(rows, { onConflict: "item_id,tag_id", ignoreDuplicates: true });
    if (upsertError) return { error: GENERIC_ERROR };
  }

  const { error: deleteError } = await supabase.from("team_tags").delete().eq("id", sourceTagId);
  if (deleteError) return { error: "Alleen de teameigenaar kan tags samenvoegen." };

  revalidatePath("/profiel/team/tags");
  revalidatePath("/zoeken");
  return { success: true };
}
