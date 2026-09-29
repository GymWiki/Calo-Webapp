import type { TeamPlan } from "@/lib/constants/subscriptionPlans";

export type TeamStatus = "active" | "past_due" | "canceled";
export type TeamMemberRole = "owner" | "member";
export type TeamInviteStatus = "pending" | "accepted" | "revoked" | "expired";

export type Team = {
  id: string;
  name: string;
  owner_user_id: string;
  plan: TeamPlan;
  seat_limit: number;
  status: TeamStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  allowed_email_domain: string | null;
  invoice_name: string | null;
  invoice_vat_number: string | null;
  created_at: string;
};

/** Rij + gejoinde naam van het lid — geen e-mail (zie lib/services/teams.ts). */
export type TeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  joined_at: string;
  first_name: string;
  last_name: string;
  /** Vrij invulbare rol/functie (zie lib/types.ts) — null = niet ingevuld. */
  role_label: string | null;
};

export type TeamInvite = {
  id: string;
  team_id: string;
  email: string;
  token: string;
  status: TeamInviteStatus;
  expires_at: string;
  created_at: string;
};

export type SeatUsage = {
  seatsUsed: number;
  seatLimit: number;
  seatsAvailable: number;
};

/**
 * Wat elke bezoeker van een uitnodigingslink te zien krijgt — puur wat
 * public.get_team_invite_by_token teruggeeft, zie
 * app/team/uitnodiging/[token]/page.tsx.
 */
export type TeamInvitePreview = {
  teamId: string;
  teamName: string;
  email: string;
  status: TeamInviteStatus;
  expiresAt: string;
};

/** Rijvorm van public.get_effective_access (zie lib/services/teams.ts). */
export type EffectiveAccessRow = {
  effective_status: string;
  team_id: string | null;
  team_role: TeamMemberRole | null;
  team_name: string | null;
};
