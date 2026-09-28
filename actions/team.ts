"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { sendTeamInviteEmail } from "@/lib/email/sendTeamInvite";
import { TEAM_PRICE_ENV_VAR, type TeamPlan } from "@/lib/constants/subscriptionPlans";

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
 * Team opzeggen — annuleert het Stripe-abonnement en zet de teams-rij op
 * status 'canceled'. De rij (en team_members/team_invites/de teambibliotheek
 * — activiteiten/tags/versies, zie supabase/migrations/team_library.sql)
 * wordt BEWUST NIET verwijderd: dat is de retentieperiode uit de brief
 * (TEAM_LIBRARY_RETENTION_DAYS, lib/constants/subscriptionPlans.ts) —
 * simpelweg nooit hard-deleten bevredigt die eis al, zonder een aparte
 * opruimjob. Zolang de rij blijft bestaan kan reactivateTeam() 'm herstellen
 * met alle inhoud intact. (Een hard delete zou hier ook stuklopen op de
 * activiteiten.team_id-foreign key zodra het team teambibliotheek-
 * activiteiten heeft.)
 *
 * status wordt hier DIRECT gezet (niet enkel gewacht op de webhook) voor
 * meteen zichtbare UI-feedback; het customer.subscription.deleted-event
 * (app/api/stripe/webhook/route.ts) zet 'm best-effort nogmaals — onschadelijk
 * dubbel werk. Leden verliezen hun teambibliotheek-toegang zodra status niet
 * meer 'active'/coulance is (public.get_effective_access, team_plans.sql) —
 * hun eigen activiteiten/opgeslagen items blijven onaangeroerd, die zijn
 * nooit aan het team gekoppeld geweest.
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
  const { error } = await service.from("teams").update({ status: "canceled" }).eq("id", team.id);
  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/profiel/team");
  return { success: true };
}

/**
 * Heractiveert een opgezegd team: maakt een NIEUW Stripe-abonnement aan
 * (send_invoice, zelfde opzet als app/api/stripe/create-team/route.ts) op
 * de bestaande stripe_customer_id, en zet dezelfde teams-rij weer op
 * 'active' — GEEN nieuwe rij, zodat team_id-referenties (teambibliotheek-
 * activiteiten/items/tags) intact blijven zonder enige migratie. Alleen
 * mogelijk terwijl de rij nog bestaat, dus effectief begrensd door hoelang
 * "nooit hard-deleten" 'm bewaart (zie cancelTeam hierboven) — er is geen
 * harde 90-dagen-afdwinging in code, dat getal is puur de communicatie-
 * belofte in de brief/UI.
 */
export async function reactivateTeam(): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { data: team } = await supabase
    .from("teams")
    .select("id, status, plan, stripe_customer_id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!team) return { error: NOT_OWNER_ERROR };
  if (team.status !== "canceled") return { error: "Dit team is niet opgezegd." };
  if (!team.stripe_customer_id) return { error: GENERIC_ERROR };

  const priceId = process.env[TEAM_PRICE_ENV_VAR[team.plan as TeamPlan]];
  if (!priceId) return { error: "Stripe is niet geconfigureerd voor dit pakket." };

  try {
    const { getStripeClient } = await import("@/lib/stripe/client");
    const stripe = getStripeClient();

    const subscription = await stripe.subscriptions.create({
      customer: team.stripe_customer_id,
      items: [{ price: priceId }],
      collection_method: "send_invoice",
      days_until_due: 30,
    });

    const service = createServiceClient();
    const { error } = await service
      .from("teams")
      .update({
        status: "active",
        stripe_subscription_id: subscription.id,
        current_period_end: null,
      })
      .eq("id", team.id);
    if (error) return { error: GENERIC_ERROR };
  } catch (cause) {
    return {
      error: cause instanceof Error ? `Heractiveren is mislukt: ${cause.message}` : GENERIC_ERROR,
    };
  }

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
