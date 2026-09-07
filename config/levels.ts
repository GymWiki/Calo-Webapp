// Centrale leveltabel — de enige plek waar levelgetallen staan, zodat ze
// later zonder codeverspreiding aan te passen zijn. `xpRequired` bepaalt
// het level (puur afgeleid van users.xp, nooit apart opgeslagen — zie
// lib/gamification.ts), de rest zijn de per-level voordelen.
export type ContributionQuota = {
  /** Aantal lessen dat binnen de periode aangemaakt moet zijn. */
  amount: number;
  /** Lengte van de contributieperiode in maanden. */
  periodMonths: number;
};

export type Level = {
  level: number;
  name: string;
  xpRequired: number;
  /**
   * Contributiequotum voor gratis leden op dit level — `null` op het
   * hoogste level betekent geen quotum meer. Pro-leden slaan deze check
   * altijd over (zie checkContributionStatus in lib/gamification.ts).
   */
  contributionQuota: ContributionQuota | null;
  /** AI-checks/maand voor gratis gebruikers op dit level (Pro = onbeperkt). */
  freeMonthlyAiLimit: number;
  /** Kortingspercentage op het Pro-abonnement, alleen relevant voor gratis gebruikers. */
  freeDiscountPercent: number;
  /** Extra AI Lescoach-generaties per maand, bovenop het reeds onbeperkte Pro-quotum — een statusprikkel, geen harde limietverhoging. */
  proBonusAiGenerations: number;
  /** Exclusieve badge-naam, alleen voor Pro-leden zichtbaar/toegekend. */
  proBadge: string | null;
  proVipSupport: boolean;
};

export const LEVELS: readonly Level[] = [
  { level: 1, name: "Beweger", xpRequired: 0, contributionQuota: { amount: 2, periodMonths: 1 }, freeMonthlyAiLimit: 20, freeDiscountPercent: 0, proBonusAiGenerations: 0, proBadge: null, proVipSupport: false },
  { level: 2, name: "Actieve Bijdrager", xpRequired: 100, contributionQuota: { amount: 2, periodMonths: 1 }, freeMonthlyAiLimit: 30, freeDiscountPercent: 2, proBonusAiGenerations: 3, proBadge: "Actieve Bijdrager", proVipSupport: false },
  { level: 3, name: "Kennisdeler", xpRequired: 300, contributionQuota: { amount: 1, periodMonths: 1 }, freeMonthlyAiLimit: 40, freeDiscountPercent: 4, proBonusAiGenerations: 8, proBadge: "Kennisdeler", proVipSupport: false },
  { level: 4, name: "Vakspecialist", xpRequired: 600, contributionQuota: { amount: 1, periodMonths: 1 }, freeMonthlyAiLimit: 50, freeDiscountPercent: 6, proBonusAiGenerations: 15, proBadge: "Vakspecialist", proVipSupport: false },
  { level: 5, name: "Ervaren Vakdocent", xpRequired: 1000, contributionQuota: { amount: 1, periodMonths: 2 }, freeMonthlyAiLimit: 60, freeDiscountPercent: 8, proBonusAiGenerations: 25, proBadge: "Ervaren Vakdocent", proVipSupport: false },
  { level: 6, name: "GymWiki Meester", xpRequired: 1500, contributionQuota: { amount: 1, periodMonths: 2 }, freeMonthlyAiLimit: 75, freeDiscountPercent: 10, proBonusAiGenerations: 35, proBadge: "GymWiki Meester", proVipSupport: false },
  { level: 7, name: "Inspirator", xpRequired: 2200, contributionQuota: { amount: 1, periodMonths: 3 }, freeMonthlyAiLimit: 90, freeDiscountPercent: 12, proBonusAiGenerations: 45, proBadge: "Inspirator", proVipSupport: true },
  { level: 8, name: "Voorloper", xpRequired: 3000, contributionQuota: { amount: 1, periodMonths: 3 }, freeMonthlyAiLimit: 110, freeDiscountPercent: 15, proBonusAiGenerations: 60, proBadge: "Voorloper", proVipSupport: true },
  { level: 9, name: "Icoon", xpRequired: 4000, contributionQuota: { amount: 1, periodMonths: 6 }, freeMonthlyAiLimit: 130, freeDiscountPercent: 18, proBonusAiGenerations: 80, proBadge: "Icoon", proVipSupport: true },
  { level: 10, name: "GymWiki Legende", xpRequired: 5500, contributionQuota: null, freeMonthlyAiLimit: 150, freeDiscountPercent: 20, proBonusAiGenerations: 100, proBadge: "GymWiki Legende", proVipSupport: true },
] as const;

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
