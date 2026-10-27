"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

// Favoriete 3D-items per gebruiker (public.material_model_favorites, zie
// supabase/migrations/material_models_taxonomy.sql). Bewust "best effort":
// de bibliotheek bewaart favorieten ook in localStorage, dus een ontbrekende
// tabel (migratie nog niet gedraaid) of een netwerkfout mag nooit de UI breken —
// de aanroeper negeert een { error } en houdt de lokale staat.

const NOT_LOGGED_IN_ERROR = "Je bent niet ingelogd.";
const GENERIC_ERROR = "Favorieten opslaan is mislukt.";

async function getAuthedSupabase() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function listModelFavorites(): Promise<{ error: string } | { success: true; slugs: string[] }> {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { data, error } = await supabase
    .from("material_model_favorites")
    .select("slug")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { error: GENERIC_ERROR };
  return { success: true, slugs: (data ?? []).map((row) => row.slug as string) };
}

export async function setModelFavorite(slug: string, favorite: boolean): Promise<{ error: string } | { success: true }> {
  if (!/^[a-z0-9_]+$/.test(slug)) return { error: GENERIC_ERROR };

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const result = favorite
    ? await supabase.from("material_model_favorites").upsert({ user_id: user.id, slug }, { onConflict: "user_id,slug" })
    : await supabase.from("material_model_favorites").delete().eq("user_id", user.id).eq("slug", slug);

  if (result.error) return { error: GENERIC_ERROR };
  return { success: true };
}
