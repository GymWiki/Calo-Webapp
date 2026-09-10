"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

type ActionResult = { error: string } | { success: true };

/**
 * Enige op dit moment bewerkbare profielveld — RLS ("users_update_own")
 * is de daadwerkelijke handhaving.
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
