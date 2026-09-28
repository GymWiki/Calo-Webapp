"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { sendTeamInviteEmail } from "@/lib/email/sendTeamInvite";

type ActionResult = { error: string } | { success: true };

const GENERIC_ERROR = "Er ging iets mis. Probeer het opnieuw.";
const NOT_LOGGED_IN_ERROR = "Je bent niet ingelogd.";
const NOT_OWNER_ERROR = "Alleen de teameigenaar kan dit doen.";

async function getOrigin(): Promise<string> {
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  return `${proto}://${headerList.get("host")}`;
}

function emailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

async function getOwnedTeam(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data } = await supabase
    .from("teams")
    .select("id, name, owner_user_id, allowed_email_domain")
    .eq("owner_user_id", userId)
    .maybeSingle();
  return data;
}

/**
 * Nodigt één of meerdere e-mailadressen uit. Elk adres wordt onafhankelijk
 * verwerkt (één ongeldig/dubbel adres blokkeert de rest niet) — de
 * seat-limiet zelf wordt server-side afgedwongen door de
 * check_team_seat_limit-trigger (supabase/migrations/team_plans.sql), niet
 * hier: dat voorkomt dat twee gelijktijdige aanroepen allebei "er is nog
 * ruimte" zien en samen over het limiet heen schieten.
 */
export async function inviteTeamMembers(
  emails: string[],
): Promise<{ error: string } | { results: { email: string; error: string | null }[] }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const team = await getOwnedTeam(supabase, user.id);
  if (!team) return { error: NOT_OWNER_ERROR };

  const { data: profile } = await supabase
    .from("users")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();
  const inviterName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Een collega";

  const origin = await getOrigin();
  const uniqueEmails = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const results: { email: string; error: string | null }[] = [];

  for (const email of uniqueEmails) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.push({ email, error: "Ongeldig e-mailadres." });
      continue;
    }

    if (team.allowed_email_domain && emailDomain(email) !== team.allowed_email_domain.toLowerCase()) {
      results.push({
        email,
        error: `Dit team accepteert alleen @${team.allowed_email_domain}-adressen.`,
      });
      continue;
    }

    const { data: invite, error } = await supabase
      .from("team_invites")
      .insert({ team_id: team.id, email, invited_by: user.id })
      .select("token")
      .single();

    if (error) {
      results.push({
        email,
        error: error.message.includes("team_invites_pending_email_idx")
          ? "Er staat al een openstaande uitnodiging voor dit adres."
          : error.message.toLowerCase().includes("seat-limiet")
            ? "Seat-limiet bereikt — upgrade je pakket voor meer plek."
            : GENERIC_ERROR,
      });
      continue;
    }

    const inviteUrl = `${origin}/team/uitnodiging/${invite.token}`;
    await sendTeamInviteEmail({ to: email, teamName: team.name, inviteUrl, inviterName });
    results.push({ email, error: null });
  }

  revalidatePath("/profiel/team");
  return { results };
}

export async function resendTeamInvite(inviteId: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const team = await getOwnedTeam(supabase, user.id);
  if (!team) return { error: NOT_OWNER_ERROR };

  const { data: invite, error: fetchError } = await supabase
    .from("team_invites")
    .select("id, email, status")
    .eq("id", inviteId)
    .eq("team_id", team.id)
    .maybeSingle();
  if (fetchError || !invite || invite.status !== "pending") {
    return { error: "Uitnodiging niet gevonden." };
  }

  const { error } = await supabase
    .from("team_invites")
    .update({ expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() })
    .eq("id", inviteId);
  if (error) return { error: GENERIC_ERROR };

  const { data: profile } = await supabase
    .from("users")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();
  const inviterName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Een collega";

  const { data: refreshed } = await supabase
    .from("team_invites")
    .select("token")
    .eq("id", inviteId)
    .single();
  if (refreshed) {
    const origin = await getOrigin();
    await sendTeamInviteEmail({
      to: invite.email,
      teamName: team.name,
      inviteUrl: `${origin}/team/uitnodiging/${refreshed.token}`,
      inviterName,
    });
  }

  revalidatePath("/profiel/team");
  return { success: true };
}

export async function revokeTeamInvite(inviteId: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const team = await getOwnedTeam(supabase, user.id);
  if (!team) return { error: NOT_OWNER_ERROR };

  const { error } = await supabase
    .from("team_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("team_id", team.id);
  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/profiel/team");
  return { success: true };
}

/**
 * Accepteert een uitnodiging — via de service-role client (bypasst RLS): de
 * uitgenodigde heeft zelf geen INSERT-recht op team_members (zie de RLS-
 * toelichting in supabase/migrations/team_plans.sql), dus deze actie doet
 * ALLE validatie zelf, vóór de service-role writes. De seat-limiet-trigger
 * (check_team_seat_limit) vuurt nog steeds — service-role omzeilt RLS, geen
 * triggers.
 */
export async function acceptTeamInvite(
  token: string,
): Promise<{ error: string } | { success: true; teamName: string }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const service = createServiceClient();

  const { data: invite } = await service
    .from("team_invites")
    .select("id, team_id, email, status, expires_at, teams(name, allowed_email_domain)")
    .eq("token", token)
    .maybeSingle();

  if (!invite) return { error: "Deze uitnodiging bestaat niet (meer)." };
  if (invite.status !== "pending") {
    return {
      error:
        invite.status === "accepted"
          ? "Deze uitnodiging is al geaccepteerd."
          : invite.status === "revoked"
            ? "Deze uitnodiging is ingetrokken door de teameigenaar."
            : "Deze uitnodiging is verlopen.",
    };
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await service.from("team_invites").update({ status: "expired" }).eq("id", invite.id);
    return { error: "Deze uitnodiging is verlopen." };
  }

  const userEmail = user.email?.toLowerCase() ?? "";
  if (userEmail !== invite.email.toLowerCase()) {
    return {
      error: `Deze uitnodiging is voor ${invite.email} — log in met dat e-mailadres om 'm te accepteren.`,
    };
  }

  const team = invite.teams as unknown as { name: string; allowed_email_domain: string | null } | null;
  if (team?.allowed_email_domain && emailDomain(userEmail) !== team.allowed_email_domain.toLowerCase()) {
    return { error: `Dit team accepteert alleen @${team.allowed_email_domain}-adressen.` };
  }

  const { data: existingMembership } = await service
    .from("team_members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingMembership) {
    return { error: "Je zit al in een team — verlaat eerst je huidige team om een nieuwe uitnodiging te accepteren." };
  }

  // Volgorde bewust: eerst de uitnodiging op 'accepted' zetten, dan pas het
  // lidmaatschap invoegen — zie de toelichting in
  // supabase/migrations/team_plans.sql's check_team_seat_limit over waarom
  // deze volgorde een dubbeltelling van dezelfde seat voorkomt.
  const { error: updateError } = await service
    .from("team_invites")
    .update({ status: "accepted", accepted_by: user.id })
    .eq("id", invite.id);
  if (updateError) return { error: GENERIC_ERROR };

  const { error: insertError } = await service
    .from("team_members")
    .insert({ team_id: invite.team_id, user_id: user.id, role: "member" });

  if (insertError) {
    // Terugdraaien: de uitnodiging telt anders mee als "geaccepteerd" zonder
    // daadwerkelijk lidmaatschap (bijv. bij een seat-limiet-race die de
    // trigger alsnog blokkeerde).
    await service.from("team_invites").update({ status: "pending" }).eq("id", invite.id);
    return {
      error: insertError.message.toLowerCase().includes("seat-limiet")
        ? "Het team zit vol — neem contact op met de eigenaar."
        : GENERIC_ERROR,
    };
  }

  revalidatePath("/profiel/team");
  return { success: true, teamName: team?.name ?? "" };
}

export async function removeTeamMember(memberId: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const team = await getOwnedTeam(supabase, user.id);
  if (!team) return { error: NOT_OWNER_ERROR };

  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("id", memberId)
    .eq("team_id", team.id);
  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/profiel/team");
  return { success: true };
}

export async function leaveTeam(): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { error } = await supabase.from("team_members").delete().eq("user_id", user.id);

  if (error) {
    return {
      error: error.message.toLowerCase().includes("eigenaar")
        ? "Als eigenaar kun je het team niet zomaar verlaten — draag eerst eigenaarschap over of zeg het team op."
        : GENERIC_ERROR,
    };
  }

  revalidatePath("/profiel/team");
  return { success: true };
}

export async function transferTeamOwnership(newOwnerUserId: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const team = await getOwnedTeam(supabase, user.id);
  if (!team) return { error: NOT_OWNER_ERROR };

  const { data: targetMember } = await supabase
    .from("team_members")
    .select("id")
    .eq("team_id", team.id)
    .eq("user_id", newOwnerUserId)
    .maybeSingle();
  if (!targetMember) return { error: "Dit lid zit niet in je team." };

  // teams.owner_user_id is bewust NIET updatebaar via de eigenaar's eigen
  // client (zie de kolom-grant-toelichting in supabase/migrations/
  // team_plans.sql) — service-role, na de eigenaarscontrole hierboven.
  const service = createServiceClient();
  const { error } = await service
    .from("teams")
    .update({ owner_user_id: newOwnerUserId })
    .eq("id", team.id);
  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/profiel/team");
  return { success: true };
}

/**
 * Team opzeggen/verwijderen — annuleert eerst het Stripe-abonnement (indien
 * aanwezig) en verwijdert dan de teams-rij, die alle leden en
 * uitnodigingen cascadeert. Leden vallen automatisch terug op hun eigen
 * gratis-via-bijdrage-status (geen aparte opruimstap nodig: dat is simpelweg
 * wat public.get_effective_access teruggeeft zodra er geen team_members-rij
 * meer bestaat) — hun eigen activiteiten/opgeslagen items blijven
 * onaangeroerd, die zijn nooit aan het team gekoppeld geweest.
 */
export async function cancelTeam(): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { data: team } = await supabase
    .from("teams")
    .select("id, stripe_subscription_id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!team) return { error: NOT_OWNER_ERROR };

  if (team.stripe_subscription_id) {
    try {
      const { getStripeClient } = await import("@/lib/stripe/client");
      const stripe = getStripeClient();
      await stripe.subscriptions.cancel(team.stripe_subscription_id);
    } catch {
      // Best-effort: als Stripe niet bereikbaar is mag het team lokaal
      // alsnog opgezegd worden — de eigenaar kan de Stripe-kant zo nodig
      // handmatig afronden via het dashboard.
    }
  }

  const service = createServiceClient();
  const { error } = await service.from("teams").delete().eq("id", team.id);
  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/profiel/team");
  return { success: true };
}

export async function updateTeamSettings(input: {
  name?: string;
  allowedEmailDomain?: string | null;
}): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const payload: Record<string, string | null> = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (trimmed.length < 2) return { error: "Vul een teamnaam in (minstens 2 tekens)." };
    payload.name = trimmed;
  }
  if (input.allowedEmailDomain !== undefined) {
    payload.allowed_email_domain = input.allowedEmailDomain?.trim().toLowerCase() || null;
  }

  const { error } = await supabase
    .from("teams")
    .update(payload)
    .eq("owner_user_id", user.id);
  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/profiel/team");
  return { success: true };
}
