"use client";

import { toast } from "sonner";

import type { LevelUpEvent } from "@/lib/gamification";

/**
 * Shared client-side notification for a level-up, fired from every action
 * that can award XP (createLesson, setLessonPublic, toggleSavedActivity).
 * Free users get the Pro-discount conversion pitch; Pro members get their
 * unlocked status perks instead.
 */
export function showLevelUpToast(levelUp: LevelUpEvent) {
  const { newLevel, isPro } = levelUp;

  if (isPro) {
    const perks = [
      `+${newLevel.proBonusAiGenerations} bonus AI Lescoach-generaties/mnd`,
      newLevel.proBadge ? `badge "${newLevel.proBadge}"` : null,
      newLevel.proVipSupport ? "VIP-support" : null,
    ].filter(Boolean);

    toast.success(
      `Level omhoog! Je bent nu ${newLevel.name} (level ${newLevel.level}).`,
      { description: perks.join(" · "), duration: 6000 },
    );
    return;
  }

  toast.success(
    `Gefeliciteerd! Je bent gestegen naar Level ${newLevel.level} (${newLevel.name}).`,
    {
      description: `Je hebt ${newLevel.freeDiscountPercent}% korting op Pro vrijgespeeld!`,
      action: {
        label: "Claim je Pro Korting",
        onClick: () => {
          // Fired from a toast action outside any component tree, so
          // useRouter() isn't available here — a full navigation is the
          // simplest correct option.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/pro";
        },
      },
      duration: 8000,
    },
  );
}
