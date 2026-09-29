"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ROLE_LABEL_MAX_LENGTH } from "@/lib/constants/profile";
import { createClient } from "@/utils/supabase/server";
import type { HolidayRegion } from "@/types/planning";

type ActionResult = { error: string } | { success: true };

/**
 * Vrij invulbare rol/functie (bijv. "Student CALO Zwolle") — vervangt de
 * vaste "Niet beschikbaar voor stage"-badge op het profiel, zie
 * components/profile/RoleLabelBadge.tsx. Lege/whitespace-only input wordt
 * null (het veld is optioneel), RLS ("users_update_own") is de daadwerkelijke
 * handhaving van "alleen je eigen rij".
 */
export async function updateRoleLabel(label: string | null): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  const trimmed = label?.trim() ?? "";
  if (trimmed.length > ROLE_LABEL_MAX_LENGTH) {
    return { error: `Rol/functie mag maximaal ${ROLE_LABEL_MAX_LENGTH} tekens zijn.` };
  }

  const { error } = await supabase
    .from("users")
    .update({ role_label: trimmed || null })
    .eq("id", user.id);

  if (error) {
    return { error: "Bijwerken is mislukt. Probeer het opnieuw." };
  }

  revalidatePath("/profiel");
  revalidatePath("/profiel/instellingen");
  revalidatePath("/profiel/team");
  return { success: true };
}

/**
 * Beschikbaar-voor-stage-toggle (/profiel/instellingen) — RLS
 * ("users_update_own") is de daadwerkelijke handhaving.
 */
export async function updateAvailableForInternship(
  available: boolean,
): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  const { error } = await supabase
    .from("users")
    .update({ available_for_internship: available })
    .eq("id", user.id);

  if (error) {
    return { error: "Bijwerken is mislukt. Probeer het opnieuw." };
  }

  revalidatePath("/profiel");
  revalidatePath("/profiel/instellingen");
  return { success: true };
}

/**
 * Regio voor de schoolvakantie-weergave in de Planning-kalender — null zet
 * de gebruiker terug op "geen voorkeur" (geen vakantie-info getoond).
 */
export async function updateHolidayRegion(region: HolidayRegion | null): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  const { error } = await supabase.from("users").update({ holiday_region: region }).eq("id", user.id);

  if (error) {
    return { error: "Bijwerken is mislukt. Probeer het opnieuw." };
  }

  revalidatePath("/profiel");
  revalidatePath("/profiel/instellingen");
  revalidatePath("/profiel/planning");
  return { success: true };
}
