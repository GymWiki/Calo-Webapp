import Link from "next/link";
import { Crown, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getXpProgress } from "@/lib/gamification";

export function LevelStatusCard({
  xp,
  isPro,
}: {
  xp: number;
  isPro: boolean;
}) {
  const { current, next, xpIntoLevel, xpForNextLevel, progressPercent } =
    getXpProgress(xp);

  const progressLabel =
    next && xpForNextLevel
      ? `${xpIntoLevel} / ${xpForNextLevel} XP naar Level ${next.level} (${next.name})`
      : "Hoogste level bereikt";

  const progressBar = (
    <div className="mt-1.5 h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${progressPercent}%` }}
      />
    </div>
  );

  if (isPro) {
    return (
      <Card className="animate-fade-up border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Crown className="size-5" />
            </div>
            <div>
              <p className="font-semibold">
                Level {current.level} · {current.name}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {current.proBadge && (
                  <>
                    Badge &quot;{current.proBadge}&quot; ·{" "}
                  </>
                )}
                +{current.proBonusAiGenerations} bonus AI Lescoach-generaties/mnd
                {current.proVipSupport && " · VIP-support"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {progressLabel}
              </p>
              {progressBar}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasDiscount = current.freeDiscountPercent > 0;

  return (
    <Card
      className={
        hasDiscount
          ? "animate-fade-up border-cone/40 bg-cone/10"
          : "animate-fade-up"
      }
    >
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cone/20 text-cone">
            <Sparkles className="size-5" />
          </div>
          <div>
            {hasDiscount ? (
              <p className="font-semibold">
                Gefeliciteerd! Je bent gestegen naar Level {current.level} (
                {current.name}). Je hebt {current.freeDiscountPercent}%
                korting op Pro vrijgespeeld!
              </p>
            ) : (
              <p className="font-semibold">
                Level {current.level} · {current.name}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {progressLabel}
              {!hasDiscount &&
                " — verdien XP met lessen maken, delen en activiteiten opslaan om korting op Pro vrij te spelen."}
            </p>
            {progressBar}
          </div>
        </div>
        {hasDiscount && (
          <Button asChild className="shrink-0">
            <Link href="/pro">Claim je Pro Korting</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
