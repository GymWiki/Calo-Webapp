import type { SupabaseClient } from "@supabase/supabase-js";

// -- Level & perk tiers -------------------------------------------------

export type Level = {
  level: number;
  name: string;
  xpRequired: number;
  /** Kortingspercentage op het Pro-abonnement, alleen relevant voor gratis gebruikers. */
  freeDiscountPercent: number;
  /** Extra AI Lescoach-generaties per maand, bovenop het reeds onbeperkte Pro-quotum — een statusprikkel, geen harde limietverhoging. */
  proBonusAiGenerations: number;
  /** Exclusieve badge-naam, alleen voor Pro-leden zichtbaar/toegekend. */
  proBadge: string | null;
  proVipSupport: boolean;
};

export const LEVELS: readonly Level[] = [
  { level: 1, name: "Beweger", xpRequired: 0, freeDiscountPercent: 0, proBonusAiGenerations: 0, proBadge: null, proVipSupport: false },
  { level: 2, name: "Actieve Bijdrager", xpRequired: 100, freeDiscountPercent: 5, proBonusAiGenerations: 3, proBadge: "Actieve Bijdrager", proVipSupport: false },
  { level: 3, name: "Kennisdeler", xpRequired: 300, freeDiscountPercent: 15, proBonusAiGenerations: 8, proBadge: "Kennisdeler", proVipSupport: false },
  { level: 4, name: "Vakspecialist", xpRequired: 700, freeDiscountPercent: 25, proBonusAiGenerations: 15, proBadge: "Vakspecialist", proVipSupport: true },
  { level: 5, name: "GymWiki Meester", xpRequired: 1500, freeDiscountPercent: 35, proBonusAiGenerations: 25, proBadge: "GymWiki Meester", proVipSupport: true },
] as const;

// -- XP-beloningen --------------------------------------------------------
// Dekt de acties die er in GymWiki daadwerkelijk bestaan: een les
// aanmaken ("uploads"), een les openbaar delen in de bibliotheek, en een
// activiteit uit de bibliotheek opslaan ("saves"). Er is (nog) geen
// like-functie op lessen/activiteiten, dus die XP-bron uit de opdracht
// heeft geen aanknopingspunt in de huidige app.
export const XP_REWARDS = {
  lessonCreated: 20,
  lessonShared: 10,
  activitySaved: 5,
} as const;

export function getLevelInfo(xp: number): Level {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.xpRequired) {
      current = level;
    }
  }
  return current;
}

export function getNextLevel(xp: number): Level | null {
  const current = getLevelInfo(xp);
  return LEVELS.find((level) => level.level === current.level + 1) ?? null;
}

export function getXpProgress(xp: number): {
  current: Level;
  next: Level | null;
  xpIntoLevel: number;
  xpForNextLevel: number | null;
  progressPercent: number;
} {
  const current = getLevelInfo(xp);
  const next = getNextLevel(xp);
  const xpIntoLevel = xp - current.xpRequired;
  const xpForNextLevel = next ? next.xpRequired - current.xpRequired : null;
  const progressPercent =
    xpForNextLevel && xpForNextLevel > 0
      ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100))
      : 100;

  return { current, next, xpIntoLevel, xpForNextLevel, progressPercent };
}

// -- Pro-pricing ------------------------------------------------------------

export const PRO_BASE_PRICE_CENTS = 999; // € 9,99 / mnd

export function getDiscountedPriceCents(freeDiscountPercent: number): number {
  return Math.round(PRO_BASE_PRICE_CENTS * (1 - freeDiscountPercent / 100));
}

export function formatEuroCents(cents: number): string {
  return (cents / 100).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
  });
}

// -- XP toekennen -----------------------------------------------------------

export type LevelUpEvent = {
  oldLevel: Level;
  newLevel: Level;
  isPro: boolean;
};

export type AwardXpResult = {
  xp: number;
  levelUp: LevelUpEvent | null;
};

/**
 * Kent XP toe aan de ingelogde gebruiker via de award_xp RPC (atomair, en
 * door RLS beperkt tot de eigen rij) en signaleert of dit een level-up
 * veroorzaakte, zodat de aanroepende server action dat in zijn
 * ActionResult kan meesturen voor een client-side melding.
 */
export async function awardXp(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
): Promise<AwardXpResult> {
  const { data, error } = await supabase
    .rpc("award_xp", { p_user_id: userId, p_amount: amount })
    .single<{ old_xp: number; new_xp: number; is_pro: boolean }>();

  if (error || !data) {
    // Nooit de aanroepende actie laten falen om een XP-boekhoudfout —
    // de kernactie (les opslaan, delen, activiteit bewaren) is al gelukt.
    return { xp: 0, levelUp: null };
  }

  const oldLevel = getLevelInfo(data.old_xp);
  const newLevel = getLevelInfo(data.new_xp);

  return {
    xp: data.new_xp,
    levelUp:
      newLevel.level > oldLevel.level
        ? { oldLevel, newLevel, isPro: data.is_pro }
        : null,
  };
}
