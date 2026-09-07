"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { recordLoginActivity, type LoginActivityResult } from "@/lib/gamification";
import { createClient } from "@/utils/supabase/server";

type ActionError = { error: string };

const GENERIC_ERROR =
  "Er ging iets mis. Controleer je verbinding en probeer het opnieuw.";

export async function login(input: {
  email: string;
  password: string;
}): Promise<ActionError | { loginActivity?: LoginActivityResult }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  try {
    const { data, error } = await supabase.auth.signInWithPassword(input);

    if (error) {
      return { error: error.message };
    }

    const loginActivity = data.user
      ? await recordLoginActivity(supabase, data.user.id)
      : null;

    return loginActivity ? { loginActivity } : {};
  } catch {
    return { error: GENERIC_ERROR };
  }
}

export async function register(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<ActionError | { needsEmailConfirmation: boolean }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  try {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          first_name: input.firstName,
          last_name: input.lastName,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (data.session && data.user) {
      // Best-effort: zet de streak/lidmaatschapsklok meteen in gang als
      // e-mailbevestiging uitstaat en de gebruiker direct is ingelogd.
      await recordLoginActivity(supabase, data.user.id);
    }

    return { needsEmailConfirmation: !data.session };
  } catch {
    return { error: GENERIC_ERROR };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  try {
    await supabase.auth.signOut();
  } catch {
    // Best-effort: fall through to redirect either way.
  }

  redirect("/");
}
