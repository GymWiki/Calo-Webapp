"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { UserRole } from "@/lib/types";

type ActionError = { error: string };

const GENERIC_ERROR =
  "Er ging iets mis. Controleer je verbinding en probeer het opnieuw.";

export async function login(input: {
  email: string;
  password: string;
}): Promise<ActionError | Record<string, never>> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  try {
    const { error } = await supabase.auth.signInWithPassword(input);

    if (error) {
      return { error: error.message };
    }

    return {};
  } catch {
    return { error: GENERIC_ERROR };
  }
}

export async function register(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
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
          role: input.role,
        },
      },
    });

    if (error) {
      return { error: error.message };
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
