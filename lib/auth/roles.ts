// Rollen van GymWiki-gebruikers. De rol staat in public.users.role (zie supabase/migrations/admin_roles_audit.sql) en wordt
// in de database afgedwongen (RLS + trigger); deze helpers zijn alleen de UI-/actielaag erboven. Er staat geen e-mailadres in de app.
import type { SupabaseClient } from "@supabase/supabase-js";

export const APP_ROLES = ["user", "admin", "owner"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export function parseRole(value: unknown): AppRole {
  return (APP_ROLES as readonly unknown[]).includes(value) ? (value as AppRole) : "user";
}

export const isAdminRole = (role: unknown): boolean => role === "admin" || role === "owner";
export const isOwnerRole = (role: unknown): boolean => role === "owner";

/** Is dit profiel een beheerder (admin of eigenaar)? */
export function isAdmin(profile: { role?: unknown } | null | undefined): boolean {
  return isAdminRole(profile?.role);
}

/** Vraagt de database zelf (public.is_admin() op de sessie); onbekend of fout geldt als "geen beheerder". */
export async function fetchIsAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}
