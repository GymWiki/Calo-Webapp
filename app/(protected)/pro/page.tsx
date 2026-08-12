import { redirect } from "next/navigation";
import { Check, Crown } from "lucide-react";

import { ProCheckoutButton } from "@/components/gamification/ProCheckoutButton";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  LEVELS,
  PRO_BASE_PRICE_CENTS,
  formatEuroCents,
  getDiscountedPriceCents,
  getLevelInfo,
} from "@/lib/gamification";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

const PRO_FEATURES = [
  "Onbeperkt AI Lescoach & Activiteiten Generator",
  "Volledige toegang tot de Kennisbank",
  "PDF-export zonder limiet",
  "Toernooi Generator",
];

export default async function ProPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.is_pro) {
    const level = getLevelInfo(profile.xp);
    return (
      <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader
          eyebrow="Pro"
          title="Je bent al Pro"
          description="Bedankt dat je GymWiki Pro gebruikt — hieronder zie je je huidige status-perks."
        />
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-6">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Crown className="size-5" />
            </div>
            <div>
              <p className="font-semibold">
                Level {level.level} · {level.name}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {level.proBadge && <>Badge &quot;{level.proBadge}&quot; · </>}+
                {level.proBonusAiGenerations} bonus AI Lescoach-generaties/mnd
                {level.proVipSupport && " · VIP-support"}
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const level = getLevelInfo(profile.xp);
  const hasDiscount = level.freeDiscountPercent > 0;
  const discountedPriceCents = getDiscountedPriceCents(level.freeDiscountPercent);
  const nextLevel = LEVELS.find((l) => l.level === level.level + 1);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="GymWiki Pro"
        title="Upgrade naar Pro"
        description="Onbeperkt AI Lescoach, volledige Kennisbank-toegang en meer — voor de vakdocent die er alles uit wil halen."
      />

      <Card className={hasDiscount ? "border-cone/40" : undefined}>
        <CardContent className="space-y-6 py-6">
          {hasDiscount && (
            <Badge className="bg-cone text-ink hover:bg-cone">
              Level {level.level} · {level.name} — {level.freeDiscountPercent}%
              Maker-korting actief
            </Badge>
          )}

          <div>
            {hasDiscount ? (
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-lg text-muted-foreground line-through">
                  Normaal {formatEuroCents(PRO_BASE_PRICE_CENTS)}/mnd
                </span>
                <span className="text-3xl font-bold tracking-tight">
                  Jouw Maker Prijs: {formatEuroCents(discountedPriceCents)}/mnd
                </span>
              </div>
            ) : (
              <span className="text-3xl font-bold tracking-tight">
                {formatEuroCents(PRO_BASE_PRICE_CENTS)}/mnd
              </span>
            )}
            {!hasDiscount && (
              <p className="mt-1 text-sm text-muted-foreground">
                Verdien XP met lessen maken, delen en activiteiten opslaan om
                korting vrij te spelen — bij Level 2 begint dat al.
              </p>
            )}
            {hasDiscount && nextLevel && (
              <p className="mt-1 text-sm text-muted-foreground">
                Nog meer korting? Level {nextLevel.level} ({nextLevel.name})
                geeft {nextLevel.freeDiscountPercent}%.
              </p>
            )}
          </div>

          <ul className="space-y-2">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                {feature}
              </li>
            ))}
          </ul>

          <ProCheckoutButton className="w-full" />
        </CardContent>
      </Card>
    </main>
  );
}
