"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
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

  if (id) {
    const { error } = await supabase
      .from("floorplans_3d")
      .update({ naam, activiteit_id: activiteitId ?? null, data })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
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
