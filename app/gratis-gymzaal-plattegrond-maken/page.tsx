import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { GuestPageShell } from "@/components/guest/GuestPageShell";
import { GuestToolLauncher } from "@/components/guest/GuestToolLauncher";
import { Button } from "@/components/ui/button";
import { GUEST_EXAMPLES } from "@/lib/guest/examples";
import { LONGTAIL_PAGES } from "@/lib/guest/longtail-pages";
import {
  TOOL_AUDIENCE,
  TOOL_DESCRIPTION,
  TOOL_FAQ,
  TOOL_H1,
  TOOL_STEPS,
  TOOL_TITLE,
  TOOL_URL,
  buildToolStructuredData,
} from "@/lib/guest/seo-content";

// Volledig statisch: alle tekst staat in de ruwe HTML. De catalogus wordt pas na een klik client-side (CDN-gecacht) opgehaald.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: TOOL_TITLE,
  description: TOOL_DESCRIPTION,
  alternates: { canonical: TOOL_URL },
  openGraph: { title: TOOL_TITLE, description: TOOL_DESCRIPTION, url: TOOL_URL, siteName: "GymWiki", locale: "nl_NL", type: "website" },
  twitter: { card: "summary_large_image", title: TOOL_TITLE, description: TOOL_DESCRIPTION },
};

export default function GratisPlattegrondPage() {
  return (
    <GuestPageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildToolStructuredData()).replace(/</g, "\\u003c") }} />

      <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-8">
        <nav aria-label="Kruimelpad" className="mb-4 text-xs text-muted-foreground">
          <ol className="flex items-center gap-1.5">
            <li><Link href="/" className="underline-offset-2 hover:underline">GymWiki</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Gratis 3D-plattegrond maken</li>
          </ol>
        </nav>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{TOOL_H1}</h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Ontwerp de opstelling van je gymles in 3D, direct in je browser. Geen account, geen installatie: sleep toestellen, matten en
              pionnen neer, bekijk het resultaat van alle kanten en exporteer het als afbeelding of PDF.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              <li>✓ Gratis, zonder account of creditcard</li>
              <li>✓ Honderden 3D-modellen van gymmateriaal</li>
              <li>✓ Export als PNG of PDF met materiaallijst</li>
              <li>✓ Deel je ontwerp met één link</li>
            </ul>
          </div>
          <GuestToolLauncher />
        </section>

        <section className="mt-16" aria-labelledby="wat-is">
          <h2 id="wat-is" className="text-2xl font-bold">Wat is de gratis 3D-plattegrondeditor?</h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Met de editor van GymWiki maak je in een paar minuten een gymzaal plattegrond in 3D. Je ziet precies hoe de zaal eruitziet met
            de toestellen, matten en het kleine materiaal op de juiste plek en op de juiste schaal. Dat helpt bij het voorbereiden van een
            les, het afstemmen met collega’s en conciërges en het inleveren van een lesplan. De editor werkt met echte afmetingen in meters,
            dus een bank van drie meter is ook in de plattegrond drie meter lang.
          </p>
        </section>

        <section className="mt-12" aria-labelledby="voor-wie">
          <h2 id="voor-wie" className="text-2xl font-bold">Voor wie is het bedoeld?</h2>
          <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-muted-foreground">
            {TOOL_AUDIENCE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="stappen">
          <h2 id="stappen" className="text-2xl font-bold">In drie stappen een plattegrond maken</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {TOOL_STEPS.map((step, index) => (
              <li key={step.titel} className="rounded-2xl border bg-card p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span>
                <h3 className="mt-3 font-semibold">{step.titel}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.tekst}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12" aria-labelledby="voorbeelden">
          <h2 id="voorbeelden" className="text-2xl font-bold">Voorbeelden om mee te beginnen</h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Open een voorbeeld hierboven in de editor, of lees meer over een specifiek gebruik:
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {LONGTAIL_PAGES.map((page) => (
              <li key={page.slug}>
                <Link href={`/${page.slug}`} className="block h-full rounded-xl border bg-card p-4 transition-colors hover:border-primary/60 hover:bg-accent">
                  <span className="font-semibold">{page.linkTitel}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{page.samenvatting}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="sr-only">{GUEST_EXAMPLES.length} voorbeeldplattegronden beschikbaar.</p>
        </section>

        <section className="mt-12" aria-labelledby="faq">
          <h2 id="faq" className="text-2xl font-bold">Veelgestelde vragen</h2>
          <dl className="mt-4 max-w-3xl divide-y rounded-2xl border bg-card">
            {TOOL_FAQ.map((item) => (
              <div key={item.question} className="p-5">
                <dt className="font-semibold">{item.question}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12 rounded-3xl bg-primary p-6 text-primary-foreground sm:p-10" aria-labelledby="account">
          <h2 id="account" className="text-2xl font-bold">Meer nodig? Maak een gratis account</h2>
          <p className="mt-2 max-w-2xl text-primary-foreground/90">
            Bewaar plattegronden in de cloud, koppel ze aan je lessen en activiteiten, en gebruik de volledige GymWiki-bibliotheek met
            lesideeën voor bewegingsonderwijs.
          </p>
          <Button asChild size="lg" className="mt-5 rounded-full bg-background text-foreground hover:bg-background/90">
            <Link href="/register">
              Gratis account maken <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </div>
    </GuestPageShell>
  );
}
