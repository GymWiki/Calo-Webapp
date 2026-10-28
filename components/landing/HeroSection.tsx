import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

import { IsoScene, type IsoBlock } from "@/components/landing/IsoScene";
import { LandingActivityCard } from "@/components/landing/LandingActivityCard";
import { TrackedLink } from "@/components/landing/TrackedLink";
import { Button } from "@/components/ui/button";
import { hero, links } from "@/content/landing.nl";
import type { PublicActivity } from "@/lib/services/publicActivities";

const THREE_D_EXAMPLE: IsoBlock[] = [
  { x: 1.5, y: 1.5, w: 3, d: 2, h: 0.35, color: "#7c5cff" },
  { x: 6.5, y: 1.2, w: 3.2, d: 1.2, h: 0.5, color: "#16a34a" },
  { x: 2, y: 5, w: 1.8, d: 1.8, h: 1.1, color: "#f59e0b" },
  { x: 6, y: 4.6, w: 3, d: 1, h: 0.4, color: "#2454ff" },
];

/** Hero: het hoofdvoordeel in één kop, twee CTA's en het echte product eronder (activiteitkaarten uit de bibliotheek). */
export function HeroSection({ showcase }: { showcase: PublicActivity[] }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pt-8 pb-14 sm:px-8 sm:pt-12 sm:pb-20">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
        <div className="animate-landing-rise">
          <p className="font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase">{hero.eyebrow}</p>
          <h1 className="font-display mt-4 text-4xl leading-[0.98] tracking-tight sm:text-5xl md:text-6xl">{hero.title}</h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">{hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-full px-7 transition-transform hover:scale-[1.03] active:scale-95 motion-reduce:transition-none">
              <TrackedLink href={links.register} event="landing_cta_primair" where="hero">
                {hero.primaryCta}
                <ArrowRight className="size-4" aria-hidden="true" />
              </TrackedLink>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7">
              <TrackedLink href={links.library} event="landing_cta_bibliotheek" where="hero">
                {hero.secondaryCta}
              </TrackedLink>
            </Button>
          </div>
          <p className="mt-5 max-w-md text-sm text-muted-foreground">{hero.note}</p>
        </div>

        <div className="animate-landing-rise" style={{ animationDelay: "120ms" }}>
          <div className="overflow-hidden rounded-2xl border border-ink/10 bg-card shadow-brand-lg dark:border-paper/10">
            <div className="flex items-center gap-2 border-b bg-muted/60 px-3 py-2">
              <span className="flex gap-1.5" aria-hidden="true">
                <span className="size-2.5 rounded-full bg-red-400" />
                <span className="size-2.5 rounded-full bg-amber-400" />
                <span className="size-2.5 rounded-full bg-green-400" />
              </span>
              <span className="mx-auto flex h-6 w-3/5 items-center gap-1.5 rounded-md bg-background px-2 text-xs text-muted-foreground" aria-hidden="true">
                <Search className="size-3" /> Zoek in de bibliotheek
              </span>
            </div>
            {/* Vaste hoogte per breakpoint: de kaarten laden later binnen, de rest van de pagina verschuift niet. */}
            <div className="bg-muted/30 p-3 sm:p-4" aria-label={hero.showcaseLabel}>
              {showcase.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {showcase.slice(0, 3).map((activity, index) => (
                    <LandingActivityCard key={activity.id} activity={activity} compact priority={index < 2} />
                  ))}
                  {/* Er is nog geen activiteit met een gekoppelde 3D-plattegrond; deze tegel is daarom een (zo benoemd) voorbeeld uit de editor. */}
                  <Link
                    href={links.editor}
                    className="group block overflow-hidden rounded-2xl border bg-card shadow-brand-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-brand-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <div className="flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-b from-orange-50 to-amber-100 dark:from-zinc-900 dark:to-zinc-800">
                      <IsoScene blocks={THREE_D_EXAMPLE} cones={[]} className="h-full w-auto p-2" />
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">{hero.threeDBadge}</p>
                      <p className="line-clamp-2 text-sm font-semibold">{hero.threeDExample}</p>
                    </div>
                  </Link>
                </div>
              ) : (
                <IsoScene blocks={[]} className="mx-auto block h-auto w-full max-w-[420px]" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
