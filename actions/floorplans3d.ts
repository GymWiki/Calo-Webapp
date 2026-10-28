"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { fetchIsAdmin } from "@/lib/auth/roles";
import { isFloorplanPreviewUrl } from "@/lib/floorplanPreview";
import { getMaterialModelsBySlugs } from "@/lib/services/materialModels";
import type { MaterialModel } from "@/types/materialModel";
import {
  floorplan3dDataSchema,
  saveFloorplan3dInputSchema,
  type Floorplan3dData,
  type Floorplan3dRow,
  type Floorplan3dSummary,
  type SaveFloorplan3dInput,
} from "@/types/floorplan3d";

const GENERIC_ERROR = "Opslaan is mislukt. Probeer het opnieuw.";
const NOT_LOGGED_IN_ERROR = "Je bent niet ingelogd.";

function logFloorplan3dError(context: string, error: unknown) {
  console.error(`floorplans3d/${context}:`, error);
}

async function getAuthedSupabase() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function listFloorplans3d(): Promise<
  { error: string } | { success: true; floorplans: Floorplan3dSummary[] }
> {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { data, error } = await supabase
    .from("floorplans_3d")
    .select("id, naam, activiteit_id, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    logFloorplan3dError("list", error);
    return { error: GENERIC_ERROR };
  }

  return { success: true, floorplans: data ?? [] };
}

export async function getFloorplan3d(
  id: string,
): Promise<{ error: string } | { success: true; floorplan: Floorplan3dRow }> {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { data, error } = await supabase
    .from("floorplans_3d")
    .select("id, naam, activiteit_id, data, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    logFloorplan3dError("get", error);
    return { error: "Plattegrond niet gevonden." };
  }

  return {
    success: true,
    floorplan: { ...data, data: data.data as Floorplan3dData },
  };
}

/**
 * Maakt een nieuwe plattegrond aan (geen `id` meegegeven) of werkt een
 * bestaande bij — zelfde upsert-achtige vorm als saveLessonDraft
 * (actions/lesson.ts). RLS (user_id = auth.uid()) is de echte handhaving
 * tegen het bijwerken van andermans rij; `id` zonder bijbehorend
 * eigendom geeft hier simpelweg 0 bijgewerkte rijen, geen foutmelding met
 * interne details.
 */
export async function saveFloorplan3d(
  input: SaveFloorplan3dInput,
): Promise<{ error: string } | { success: true; id: string }> {
  const parsed = saveFloorplan3dInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { id, naam, activiteitId, data } = parsed.data;

  // Koppelen aan een activiteit mag alleen aan een EIGEN activiteit (de
  // select-policy op floorplans_3d eist hetzelfde: plattegrond-eigenaar =
  // auteur van de activiteit). Geen activiteitId meegegeven bij een update =
  // koppeling ongemoeid laten (voorheen werd die hier stilletjes gewist).
  // Beheerders (public.is_admin(), afgedwongen door RLS) mogen elke plattegrond opslaan en aan elke activiteit koppelen.
  const isAdmin = id || activiteitId ? await fetchIsAdmin(supabase) : false;

  if (activiteitId) {
    const { data: activity } = await supabase
      .from("activiteiten")
      .select("author_id")
      .eq("id", activiteitId)
      .maybeSingle();
    if (!activity || (activity.author_id !== user.id && !isAdmin)) {
      return { error: "Je kunt een plattegrond alleen aan je eigen activiteit koppelen." };
    }
  }

  if (id) {
    let update = supabase
      .from("floorplans_3d")
      .update({ naam, data, ...(activiteitId ? { activiteit_id: activiteitId } : {}) })
      .eq("id", id);
    if (!isAdmin) update = update.eq("user_id", user.id);
    const { data: updated, error } = await update.select("id");

    if (error || !updated?.length) {
      logFloorplan3dError("update", error);
      return { error: GENERIC_ERROR };
    }
    return { success: true, id };
  }

  const { data: created, error } = await supabase
    .from("floorplans_3d")
    .insert({ user_id: user.id, naam, activiteit_id: activiteitId ?? null, data })
    .select("id")
    .single();

  if (error || !created) {
    logFloorplan3dError("insert", error);
    return { error: GENERIC_ERROR };
  }
  return { success: true, id: created.id };
}

export async function renameFloorplan3d(
  id: string,
  naam: string,
): Promise<{ error: string } | { success: true }> {
  const trimmed = naam.trim();
  if (!trimmed) return { error: "Naam is verplicht." };

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { error } = await supabase
    .from("floorplans_3d")
    .update({ naam: trimmed })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    logFloorplan3dError("rename", error);
    return { error: GENERIC_ERROR };
  }
  return { success: true };
}

export async function deleteFloorplan3d(
  id: string,
): Promise<{ error: string } | { success: true }> {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { error } = await supabase
    .from("floorplans_3d")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    logFloorplan3dError("delete", error);
    return { error: "Verwijderen is mislukt. Probeer het opnieuw." };
  }
  return { success: true };
}

const PREVIEW_BUCKET = "floorplan-previews";
const MAX_PREVIEW_BYTES = 600 * 1024;

/**
 * Slaat de thumbnail ("statische preview") van een plattegrond op — door de
 * editor gerenderd (components/canvas-3d/FloorplanThumbnailCapture.tsx) en
 * hier als data-URL aangeleverd. Pad `${user_id}/${floorplan_id}.jpg`
 * (upsert), zie supabase/migrations/floorplans_3d_activity_view.sql.
 * Best-effort: een mislukte upload mag het opslaan zelf nooit blokkeren.
 */
export async function saveFloorplanPreview(
  floorplanId: string,
  dataUrl: string,
): Promise<{ error: string } | { success: true }> {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return { error: "Ongeldige preview." };

  const bytes = Buffer.from(match[1], "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PREVIEW_BYTES) return { error: "Preview is te groot." };

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  // Eigenaar van de plattegrond: de preview staat in diens map. Een beheerder mag ook andermans plattegrond bijwerken
  // (RLS: floorplans_3d_admin_select + floorplan_previews_admin_rw).
  const admin = await fetchIsAdmin(supabase);
  let ownedQuery = supabase.from("floorplans_3d").select("id, activiteit_id, user_id").eq("id", floorplanId);
  if (!admin) ownedQuery = ownedQuery.eq("user_id", user.id);
  const { data: owned } = await ownedQuery.maybeSingle();
  if (!owned) return { error: "Plattegrond niet gevonden." };
  const ownerId = owned.user_id as string;

  const { error } = await supabase.storage
    .from(PREVIEW_BUCKET)
    .upload(`${ownerId}/${floorplanId}.jpg`, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) {
    logFloorplan3dError("preview", error);
    return { error: GENERIC_ERROR };
  }

  // Heeft de gekoppelde activiteit nog geen afbeelding, dan wordt de thumbnail ook de kaartafbeelding / OG-afbeelding van de
  // activiteit (activiteiten.afbeelding). Een eigen afbeelding wordt NOOIT overschreven; alleen een eerdere thumbnail wordt
  // ververst. (Voor een beheerder geldt dit voor elke activiteit, voor anderen alleen voor de eigen.)
  if (owned.activiteit_id) {
    let activityQuery = supabase.from("activiteiten").select("afbeelding").eq("id", owned.activiteit_id);
    if (!admin) activityQuery = activityQuery.eq("author_id", user.id);
    const { data: activity } = await activityQuery.maybeSingle();
    if (activity && (!activity.afbeelding || isFloorplanPreviewUrl(activity.afbeelding))) {
      const { publicUrl } = supabase.storage.from(PREVIEW_BUCKET).getPublicUrl(`${ownerId}/${floorplanId}.jpg`).data;
      let write = supabase.from("activiteiten").update({ afbeelding: `${publicUrl}?v=${Date.now()}` }).eq("id", owned.activiteit_id);
      if (!admin) write = write.eq("author_id", user.id);
      await write;
    }
  }
  return { success: true };
}

/**
 * Gegevens voor de alleen-lezen viewer (<PlattegrondViewer plattegrondId=...>):
 * de plattegrond zelf (RLS bepaalt of je hem mag zien) plus alleen de
 * materiaalmodellen die hij gebruikt.
 */
export async function getFloorplan3dViewData(
  id: string,
): Promise<{ error: string } | { success: true; data: Floorplan3dData; models: MaterialModel[] }> {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { data, error } = await supabase.from("floorplans_3d").select("data").eq("id", id).maybeSingle();
  if (error || !data) return { error: "Plattegrond niet gevonden." };

  const parsed = floorplan3dDataSchema.safeParse(data.data);
  if (!parsed.success) return { error: "Plattegrond kon niet worden geladen." };

  try {
    const models = await getMaterialModelsBySlugs(supabase, parsed.data.items.map((item) => item.slug));
    return { success: true, data: parsed.data, models };
  } catch (modelError) {
    logFloorplan3dError("view-models", modelError);
    return { error: "Plattegrond kon niet worden geladen." };
  }
}
