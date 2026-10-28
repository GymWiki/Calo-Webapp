import type { Metadata } from "next";
import Link from "next/link";

import { GymWikiLogo } from "@/components/GymWikiLogo";
import { HeroSection } from "@/components/landing/HeroSection";
import {
  AudienceSection,
  EditorSection,
  FaqSection,
  FeatureSection,
  FinalCtaSection,
  HowItWorksSection,
  LibraryPreviewSection,
  PricingSection,
  ProofSection,
  ProblemSection,
} from "@/components/landing/LandingSections";
import { ScrollDepth } from "@/components/landing/ScrollDepth";
import { TrackedLink } from "@/components/landing/TrackedLink";
import { Button } from "@/components/ui/button";
import { SITE_URL, footer, links, meta, nav } from "@/content/landing.nl";
import { buildLandingStructuredData } from "@/lib/landing/structured-data";
import { getLandingSnapshot } from "@/lib/services/landing";

// Publieke marketingpagina zonder gebruikerssessie: statisch gegenereerd en elk uur ververst, zodat de cijfers en kaarten
// uit de database actueel blijven zonder dat elke bezoeker Supabase raakt. Alle teksten staan in content/landing.nl.ts.
export const revalidate = 3600;

// Server-gerenderd (dus in de ruwe HTML). og:image komt van app/opengraph-image.tsx.
export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  alternates: { canonical: SITE_URL },
  openGraph: { title: meta.title, description: meta.description, url: SITE_URL, siteName: "GymWiki", locale: "nl_NL", type: "website" },
  twitter: { card: "summary_large_image", title: meta.title, description: meta.description },
};

export default async function LandingPage() {
  // Elk onderdeel van de snapshot faalt los; bij een volledige storing blijft de rest van de pagina gewoon werken.
  const snapshot = await getLandingSnapshot().catch(() => ({ activityCount: null, leerlijnCount: null, materialCount: null, preview: [] }));

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* JSON-LD in de ruwe HTML; `<` ontsnapt zodat geen "</script>" in de tekst de tag kan afsluiten. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildLandingStructuredData()).replace(/</g, "\\u003c") }} />

      <ScrollDepth>
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-8">
          <GymWikiLogo size={32} wordmarkClassName="text-xl" />
          <nav aria-label="Hoofdmenu" className="flex items-center gap-5">
            {nav.items.map((item) => (
              <a key={item.href} href={item.href} className="hidden text-sm font-medium text-foreground/70 underline-offset-4 hover:text-foreground hover:underline lg:inline">
                {item.label}
              </a>
            ))}
            <Link href={links.login} className="text-sm font-medium text-foreground/70 underline-offset-4 hover:text-foreground hover:underline">
              {nav.login}
            </Link>
            <Button asChild size="sm" className="rounded-full">
              <TrackedLink href={links.register} event="landing_cta_primair" where="header">
                {nav.cta}
              </TrackedLink>
            </Button>
          </nav>
        </header>

        <main>
          <HeroSection showcase={snapshot.preview} />
          <ProblemSection />
          <HowItWorksSection />
          <FeatureSection activityCount={snapshot.activityCount} />
          <EditorSection materialCount={snapshot.materialCount} />
          <AudienceSection />
          <LibraryPreviewSection snapshot={snapshot} />
          <PricingSection />
          <ProofSection snapshot={snapshot} />
          <FaqSection />
          <FinalCtaSection />
        </main>

        <footer className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>{footer.tagline}</span>
          <nav aria-label="Meer van GymWiki" className="flex flex-wrap gap-x-5 gap-y-2">
            {footer.links.map((item) => (
              <Link key={item.href} href={item.href} className="underline-offset-4 hover:underline">
                {item.label}
              </Link>
            ))}
          </nav>
        </footer>
      </ScrollDepth>
    </div>
  );
}
