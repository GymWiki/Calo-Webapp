import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ActivityVersionSummary,
  TeamLibraryItem,
  TeamLibraryItemKind,
  TeamTag,
} from "@/types/teamLibrary";

type TeamTagRow = {
  id: string;
  team_id: string;
  name: string;
  color: string | null;
  created_by: string | null;
  created_at: string;
};

function toTeamTag(row: TeamTagRow, itemCount?: number): TeamTag {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    color: row.color,
    createdBy: row.created_by,
    createdAt: row.created_at,
    itemCount,
  };
}

export async function getTeamTags(
  supabase: SupabaseClient,
  teamId: string,
): Promise<TeamTag[]> {
  const { data, error } = await supabase
    .from("team_tags")
    .select("id, team_id, name, color, created_by, created_at")
    .eq("team_id", teamId)
    .order("name", { ascending: true })
    .returns<TeamTagRow[]>();

  if (error) {
    throw new Error(`Kon team-tags niet ophalen: ${error.message}`);
  }

  return (data ?? []).map((row) => toTeamTag(row));
}

/** Tags-beheerpagina: elke tag + het aantal items waaraan hij hangt. */
export async function getTeamTagsWithCounts(
  supabase: SupabaseClient,
  teamId: string,
): Promise<TeamTag[]> {
  const [{ data: tags, error: tagsError }, { data: links, error: linksError }] = await Promise.all([
    supabase
      .from("team_tags")
      .select("id, team_id, name, color, created_by, created_at")
      .eq("team_id", teamId)
      .order("name", { ascending: true })
      .returns<TeamTagRow[]>(),
    supabase
      .from("team_library_item_tags")
      .select("tag_id, team_library_items!inner(team_id)")
      .eq("team_library_items.team_id", teamId),
  ]);

  if (tagsError) {
    throw new Error(`Kon team-tags niet ophalen: ${tagsError.message}`);
  }
  if (linksError) {
    throw new Error(`Kon tag-gebruik niet ophalen: ${linksError.message}`);
  }

  const counts = new Map<string, number>();
  for (const link of links ?? []) {
    counts.set(link.tag_id, (counts.get(link.tag_id) ?? 0) + 1);
  }

  return (tags ?? []).map((row) => toTeamTag(row, counts.get(row.id) ?? 0));
}

/**
 * Alle teambibliotheek-items van een team, met hun tags — één kaart hoeft
 * zo geen aparte query te doen. Sleutel = activity_id (waar de UI al op
 * itereert via getTeamActivities).
 */
export async function getTeamLibraryItemsByActivity(
  supabase: SupabaseClient,
  teamId: string,
): Promise<Map<string, TeamLibraryItem>> {
  const { data: items, error: itemsError } = await supabase
    .from("team_library_items")
    .select("id, team_id, activity_id, kind, added_by, added_at")
    .eq("team_id", teamId)
    .returns<{
      id: string;
      team_id: string;
      activity_id: string;
      kind: TeamLibraryItemKind;
      added_by: string | null;
      added_at: string;
    }[]>();

  if (itemsError) {
    throw new Error(`Kon teambibliotheek-items niet ophalen: ${itemsError.message}`);
  }

  const byActivity = new Map<string, TeamLibraryItem>();
  const byItemId = new Map<string, TeamLibraryItem>();
  for (const row of items ?? []) {
    const item: TeamLibraryItem = {
      id: row.id,
      teamId: row.team_id,
      activityId: row.activity_id,
      kind: row.kind,
      addedBy: row.added_by,
      addedAt: row.added_at,
      tags: [],
    };
    byActivity.set(row.activity_id, item);
    byItemId.set(row.id, item);
  }

  if (byItemId.size === 0) return byActivity;

  const { data: tagLinks, error: tagsError } = await supabase
    .from("team_library_item_tags")
    .select("item_id, team_tags(id, team_id, name, color, created_by, created_at)")
    .in("item_id", [...byItemId.keys()]);

  if (tagsError) {
    throw new Error(`Kon tags per item niet ophalen: ${tagsError.message}`);
  }

  for (const row of tagLinks ?? []) {
    const item = byItemId.get(row.item_id);
    const tag = row.team_tags as unknown as TeamTagRow | null;
    if (!item || !tag) continue;
    item.tags.push(toTeamTag(tag));
  }

  return byActivity;
}

export async function getTeamLibraryItemForActivity(
  supabase: SupabaseClient,
  teamId: string,
  activityId: string,
): Promise<TeamLibraryItem | null> {
  const { data: item, error } = await supabase
    .from("team_library_items")
    .select("id, team_id, activity_id, kind, added_by, added_at")
    .eq("team_id", teamId)
    .eq("activity_id", activityId)
    .maybeSingle();

  if (error) {
    throw new Error(`Kon teambibliotheek-item niet ophalen: ${error.message}`);
  }
  if (!item) return null;

  const { data: tagLinks, error: tagsError } = await supabase
    .from("team_library_item_tags")
    .select("team_tags(id, team_id, name, color, created_by, created_at)")
    .eq("item_id", item.id);

  if (tagsError) {
    throw new Error(`Kon tags niet ophalen: ${tagsError.message}`);
  }

  return {
    id: item.id,
    teamId: item.team_id,
    activityId: item.activity_id,
    kind: item.kind,
    addedBy: item.added_by,
    addedAt: item.added_at,
    tags: (tagLinks ?? [])
      .map((row) => row.team_tags as unknown as TeamTagRow | null)
      .filter((row): row is TeamTagRow => row !== null)
      .map((row) => toTeamTag(row)),
  };
}

/** "Vorige versies" — nieuwste eerst, met de naam van wie die versie maakte. */
export async function getActivityVersions(
  supabase: SupabaseClient,
  activityId: string,
): Promise<ActivityVersionSummary[]> {
  const { data, error } = await supabase
    .from("activity_versions")
    .select("id, version, changed_by, changed_at, users(first_name, last_name)")
    .eq("activity_id", activityId)
    .order("version", { ascending: false });

  if (error) {
    throw new Error(`Kon versiegeschiedenis niet ophalen: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const user = row.users as unknown as { first_name: string; last_name: string } | null;
    return {
      id: row.id,
      version: row.version,
      changedBy: row.changed_by,
      changedByName: user ? `${user.first_name} ${user.last_name}`.trim() : null,
      changedAt: row.changed_at,
    };
  });
}
