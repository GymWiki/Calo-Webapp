import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { rateLimited } from "@/lib/auth/rate-limit";
import { fetchIsAdmin, parseRole, type AppRole } from "@/lib/auth/roles";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { createClient } from "@/utils/supabase/server";
import type { UserProfile } from "@/lib/types";

export const NOT_LOGGED_IN = "Je bent niet ingelogd.";
export const NOT_ADMIN = "Alleen beheerders kunnen dit doen.";
export const RATE_LIMITED = "Even rustig aan: te veel wijzigingen kort achter elkaar. Probeer het zo opnieuw.";

/** Pagina's onder /beheer: wie geen beheerder is krijgt een 404 (anoniem wordt al in proxy.ts naar /login gestuurd). */
export async function requireAdminPage(): Promise<UserProfile> {
  const profile = await getCurrentUserProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "owner")) notFound();
  return profile;
}

export type AdminContext = { supabase: SupabaseClient; user: User; role: AppRole };

/**
 * Server-acties en route handlers: controleert de rol server-side in de DATABASE (public.is_admin() op de sessie), niet op
 * iets wat de client meestuurt. RLS blijft de echte grens; dit geeft een nette foutmelding en de rate limit.
 */
export async function getAdminContext(options: { write?: boolean } = {}): Promise<AdminContext | { error: string }> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN };
  if (!(await fetchIsAdmin(supabase))) return { error: NOT_ADMIN };
  if (options.write && rateLimited(`beheer:${user.id}`)) return { error: RATE_LIMITED };
  const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  return { supabase, user, role: parseRole(data?.role) };
}
