import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  EffectiveAccessRow,
  Team,
  TeamInvite,
  TeamInvitePreview,
  TeamMember,
  SeatUsage,
} from "@/types/team";

/**
 * Deze codebase genereert geen Database-type voor de Supabase-client, dus
 * `.rpc(...)` (ongelijk aan `.from("tabel").select(...)`, dat wél via de
 * losstaande `Activity`/`PublicActivity`-types met `.returns<T>()` getypeerd
 * wordt) komt terug als `{}`. Eén kleine cast-helper i.p.v. die `as unknown
 * as T` drie keer losstaand herhalen.
 */
function castRpcRow<T>(data: unknown): T | null {
  return (data ?? null) as T | null;
}

/**
 * Effectieve toegangsstatus van de huidige gebruiker (eigen betaling OF
 * actief team) — zie public.get_effective_access,
 * supabase/migrations/team_plans.sql. Gedeeld door lib/supabase/
 * get-current-profile.ts, actions/planning.ts en
 * app/api/ai/analyze-lesson/route.ts, zodat teamlidmaatschap overal
 * consistent als paid_subscriber telt.
 */
export async function getEffectiveAccess(
  supabase: SupabaseClient,
): Promise<EffectiveAccessRow | null> {
  const { data, error } = await supabase.rpc("get_effective_access").maybeSingle();
  if (error) return null;
  return castRpcRow<EffectiveAccessRow>(data);
}

/**
 * Het team van de huidige gebruiker, als eigenaar of als lid — een
 * gebruiker zit nooit in meer dan één team (unique(user_id) op
 * team_members, zie supabase/migrations/team_plans.sql), dus dit is altijd
 * hoogstens één rij. RLS (teams_select) regelt dat je hier alleen je eigen
 * team via terugkrijgt.
 */
export async function getMyTeam(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ team: Team; role: "owner" | "member" } | null> {
  const { data: ownedTeam } = await supabase
    .from("teams")
    .select("*")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (ownedTeam) {
    return { team: ownedTeam as Team, role: "owner" };
  }

  const { data: membership } = await supabase
    .from("team_members")
    .select("teams(*)")
    .eq("user_id", userId)
    .maybeSingle();

  const team = membership?.teams as unknown as Team | null | undefined;
  if (!team) return null;

  return { team, role: "member" };
}

export async function getTeamMembers(
  supabase: SupabaseClient,
  teamId: string,
): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("id, team_id, user_id, role, joined_at, users(first_name, last_name, role_label)")
    .eq("team_id", teamId)
    .order("joined_at", { ascending: true });

  if (error) {
    throw new Error(`Kon teamleden niet ophalen: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const user = row.users as unknown as {
      first_name: string;
      last_name: string;
      role_label: string | null;
    } | null;
    return {
      id: row.id,
      team_id: row.team_id,
      user_id: row.user_id,
      role: row.role,
      joined_at: row.joined_at,
      first_name: user?.first_name ?? "",
      last_name: user?.last_name ?? "",
      role_label: user?.role_label ?? null,
    };
  });
}

/** Openstaande + recent afgehandelde uitnodigingen (max 50, nieuwste eerst). */
export async function getTeamInvites(
  supabase: SupabaseClient,
  teamId: string,
): Promise<TeamInvite[]> {
  const { data, error } = await supabase
    .from("team_invites")
    .select("id, team_id, email, token, status, expires_at, created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Kon uitnodigingen niet ophalen: ${error.message}`);
  }

  return data ?? [];
}

export async function getSeatUsage(
  supabase: SupabaseClient,
  teamId: string,
): Promise<SeatUsage | null> {
  const { data: raw, error } = await supabase
    .rpc("get_team_seat_usage", { p_team_id: teamId })
    .maybeSingle();
  const data = castRpcRow<{ seats_used: number; seat_limit: number }>(raw);

  if (error || !data) return null;

  return {
    seatsUsed: data.seats_used,
    seatLimit: data.seat_limit,
    seatsAvailable: Math.max(data.seat_limit - data.seats_used, 0),
  };
}

export async function getTeamAiUsage(
  supabase: SupabaseClient,
  teamId: string,
  seatLimit: number,
  perSeatLimit: number,
): Promise<{ used: number; limit: number; remaining: number }> {
  const { data } = await supabase.rpc("get_team_ai_usage_count", {
    p_team_id: teamId,
    p_feature: "ai_lescoach",
  });

  const limit = seatLimit * perSeatLimit;
  const used = (data as number | null) ?? 0;
  return { used, limit, remaining: Math.max(limit - used, 0) };
}

/** Publieke lookup voor de uitnodiging-acceptatiepagina — werkt ook uitgelogd. */
export async function getTeamInvitePreview(
  supabase: SupabaseClient,
  token: string,
): Promise<TeamInvitePreview | null> {
  const { data: raw, error } = await supabase
    .rpc("get_team_invite_by_token", { p_token: token })
    .maybeSingle();
  const data = castRpcRow<{
    team_id: string;
    team_name: string;
    email: string;
    status: string;
    expires_at: string;
  }>(raw);

  if (error || !data) return null;

  return {
    teamId: data.team_id,
    teamName: data.team_name,
    email: data.email,
    status: data.status as TeamInvitePreview["status"],
    expiresAt: data.expires_at,
  };
}
