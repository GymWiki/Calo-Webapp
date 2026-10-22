"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { isLibraryAdmin } from "@/lib/adminAccess";
import { textToArrayField } from "@/lib/ai/languageCheckPrompt";
import { LANGUAGE_CHECK_FIELDS } from "@/lib/ai/languageCheck";

type ActionResult = { error: string } | { success: true };
type ApplyResult = { error: string } | { success: true; appliedCount: number };

const GENERIC_ERROR = "Actie is mislukt. Probeer het opnieuw.";
const NOT_LOGGED_IN_ERROR = "Je bent niet ingelogd.";
const NOT_ADMIN_ERROR = "Je hebt geen toegang tot het taalcheck-beheer.";
const REVIEW_PATH = "/beheer/taalcheck";

type AdminAuthResult =
  | { error: string }
  | { supabase: ReturnType<typeof createClient>; userId: string };

// Zelfde patroon als actions/knowledgePackages.ts se requireLibraryAdmin —
// RLS (is_library_admin() in de migratie) is de echte handhaving, dit is de
// nette-foutmelding-laag ervoor.
async function requireLibraryAdmin(): Promise<AdminAuthResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NOT_LOGGED_IN_ERROR };
  }

  if (!isLibraryAdmin(user.email)) {
    return { error: NOT_ADMIN_ERROR };
  }

  return { supabase, userId: user.id };
}

async function runAction<T extends ActionResult | ApplyResult>(
  actionName: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    console.error(`${actionName}: onverwachte fout:`, cause);
    return { error: GENERIC_ERROR } as T;
  }
}

/**
 * Markeert een voorstel als goedgekeurd — schrijft NOG NIETS naar de live
 * `activiteiten`-tabel (zie applyApprovedTaalcheckVoorstellen hieronder,
 * de aparte, expliciete toepasstap). Dat tussenstation is bewust: een
 * goedkeuring is een reviewbeslissing, het daadwerkelijk overschrijven van
 * gedeelde bibliotheekdata is een aparte, onomkeerbare actie.
 */
export async function approveTaalcheckVoorstel(voorstelId: string): Promise<ActionResult> {
  return runAction("approveTaalcheckVoorstel", async () => {
    const auth = await requireLibraryAdmin();
    if ("error" in auth) return { error: auth.error };

    const { error } = await auth.supabase
      .from("activiteiten_taalcheck_voorstellen")
      .update({ status: "approved", beoordeeld_op: new Date().toISOString(), beoordeeld_door: auth.userId })
      .eq("id", voorstelId)
      .eq("status", "pending");

    if (error) {
      console.error("approveTaalcheckVoorstel: update mislukt:", error.message);
      return { error: GENERIC_ERROR };
    }

    revalidatePath(REVIEW_PATH);
    return { success: true };
  });
}

export async function rejectTaalcheckVoorstel(voorstelId: string): Promise<ActionResult> {
  return runAction("rejectTaalcheckVoorstel", async () => {
    const auth = await requireLibraryAdmin();
    if ("error" in auth) return { error: auth.error };

    const { error } = await auth.supabase
      .from("activiteiten_taalcheck_voorstellen")
      .update({ status: "rejected", beoordeeld_op: new Date().toISOString(), beoordeeld_door: auth.userId })
      .eq("id", voorstelId)
      .eq("status", "pending");

    if (error) {
      console.error("rejectTaalcheckVoorstel: update mislukt:", error.message);
      return { error: GENERIC_ERROR };
    }

    revalidatePath(REVIEW_PATH);
    return { success: true };
  });
}

const ARRAY_FIELDS = new Set(
  LANGUAGE_CHECK_FIELDS.filter((entry) => entry.isArray).map((entry) => entry.field as string),
);

/**
 * Past elk momenteel 'approved' voorstel toe op de live `activiteiten`-rij:
 * schrijft het veld (array-velden worden teruggesplitst op regels, zie
 * lib/ai/languageCheckPrompt.ts), zet last_language_check_at, en markeert
 * het voorstel als 'applied'. Verwerkt voorstellen na elkaar (niet in bulk)
 * zodat één mislukte update de rest niet blokkeert — het resultaat meldt
 * hoeveel er daadwerkelijk zijn toegepast.
 */
export async function applyApprovedTaalcheckVoorstellen(): Promise<ApplyResult> {
  return runAction("applyApprovedTaalcheckVoorstellen", async () => {
    const auth = await requireLibraryAdmin();
    if ("error" in auth) return { error: auth.error };

    const { data: voorstellen, error: fetchError } = await auth.supabase
      .from("activiteiten_taalcheck_voorstellen")
      .select("id, activiteit_id, veldnaam, voorgestelde_tekst")
      .eq("status", "approved");

    if (fetchError) {
      console.error("applyApprovedTaalcheckVoorstellen: ophalen mislukt:", fetchError.message);
      return { error: GENERIC_ERROR };
    }
    if (!voorstellen || voorstellen.length === 0) {
      return { success: true, appliedCount: 0 };
    }

    const now = new Date().toISOString();
    let appliedCount = 0;

    for (const voorstel of voorstellen) {
      const veldnaam = voorstel.veldnaam as string;
      const value = ARRAY_FIELDS.has(veldnaam)
        ? textToArrayField(voorstel.voorgestelde_tekst as string)
        : (voorstel.voorgestelde_tekst as string);

      const { error: updateError } = await auth.supabase
        .from("activiteiten")
        .update({ [veldnaam]: value, last_language_check_at: now })
        .eq("id", voorstel.activiteit_id as string);

      if (updateError) {
        console.error(
          `applyApprovedTaalcheckVoorstellen: activiteit ${voorstel.activiteit_id} veld ${veldnaam} mislukt:`,
          updateError.message,
        );
        continue;
      }

      const { error: markError } = await auth.supabase
        .from("activiteiten_taalcheck_voorstellen")
        .update({ status: "applied", toegepast_op: now })
        .eq("id", voorstel.id as string);

      if (markError) {
        console.error(
          `applyApprovedTaalcheckVoorstellen: voorstel ${voorstel.id} markeren mislukt:`,
          markError.message,
        );
        continue;
      }

      appliedCount += 1;
    }

    revalidatePath(REVIEW_PATH);
    return { success: true, appliedCount };
  });
}
