import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import {
  FREE_PLAN_INFO,
  MONTHLY_CONTRIBUTION_REQUIRED_COUNT,
  SUBSCRIPTION_PLANS,
} from "@/lib/constants/subscriptionPlans";

// Publieke, niet-ingelogde FAQ-pagina — zie STAP 7 van de SEO/GEO-brief.
// Antwoorden gebruiken dezelfde centrale prijs-/quotumconfiguratie als de
// landingspagina (app/page.tsx), zodat de twee nooit uit de pas lopen.
export const revalidate = 3600;

const BASE_URL = "https://www.gymwiki.nl";
const TITLE = "Over GymWiki — veelgestelde vragen";
const DESCRIPTION =
  "Wat is GymWiki, voor wie is het, wat kost het, hoe werkt de bijdrage-regeling, en op welke didactische basis (TGfU, Basisdocument Bewegingsonderwijs) is de activiteitenbibliotheek gebouwd.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${BASE_URL}/over-gymwiki` },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: `${BASE_URL}/over-gymwiki`,
    siteName: "GymWiki",
    locale: "nl_NL",
  },
};

const FAQ_ITEMS = [
  {
    question: "Wat is GymWiki?",
    answer:
      "GymWiki is de activiteitenbibliotheek voor bewegingsonderwijs: een gedeelde, doorzoekbare verzameling lesideeën, gebouwd en gecontroleerd door vakleerkrachten lichamelijke opvoeding en CALO-studenten. Elke activiteit is opgebouwd rond een expliciet lesdoel, een beginsituatie/doelgroep en meetbare leeruitkomsten — geen losse, lukrake spelletjes.",
  },
  {
    question: "Voor wie is GymWiki?",
    answer:
      "GymWiki is gebouwd voor vakleerkrachten lichamelijke opvoeding en CALO-studenten die hun gymles voorbereiden. Gebruikers doorzoeken de activiteitenbibliotheek, dragen zelf activiteiten bij, en gebruiken een canvas-editor om plattegronden en veldopstellingen te ontwerpen.",
  },
  {
    question: "Wat kost GymWiki?",
    answer: `GymWiki is gratis zolang je minstens ${MONTHLY_CONTRIBUTION_REQUIRED_COUNT} activiteiten per maand deelt met de gezamenlijke bibliotheek (elke bijdrage gaat eerst langs een AI-kwaliteitscontrole). Liever niet zelf bijdragen? Dan kost het ${SUBSCRIPTION_PLANS.monthly.priceLabel} per maand, ${SUBSCRIPTION_PLANS.yearly.priceLabel} per jaar, of eenmalig ${SUBSCRIPTION_PLANS.lifetime.priceLabel} voor levenslange toegang.`,
  },
  {
    question: "Hoe werkt de bijdrage-regeling?",
    answer: `Deel je in een kalendermaand minstens ${MONTHLY_CONTRIBUTION_REQUIRED_COUNT} activiteiten die de AI-kwaliteitscontrole doorstaan, dan houd je die maand volledige, gratis toegang tot de bibliotheek. Haal je dat aantal niet, dan wordt je toegang de volgende maand beperkt tot je eigen bijdragen — totdat je weer voldoende deelt, of overstapt op een van de betaalde opties.`,
  },
  {
    question: "Op welke didactische basis is GymWiki gebouwd?",
    answer:
      "Elke activiteit koppelt aan een leerlijn en bewegingsthema uit het Basisdocument Bewegingsonderwijs, met expliciete leeruitkomsten in plaats van vrijblijvende spelbeschrijvingen. De leerhulp-analyse per activiteit volgt de 3 L's van Walinga & Koekoek (2021) — Loopt 't, Lukt 't, Leeft 't — met concrete subthema's zoals TGfU (Teaching Games for Understanding), deliberate play en differentiatie, zodat een docent niet alleen wéét wat er moet gebeuren, maar ook waaróm.",
  },
] as const;

function buildFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${BASE_URL}/over-gymwiki#faq`,
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export default function OverGymWikiPage() {
  const jsonLd = buildFaqJsonLd();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Over GymWiki" }]} />

      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Over GymWiki</h1>
        <p className="text-base leading-relaxed text-foreground/80 sm:text-lg">{DESCRIPTION}</p>
      </div>

      <div className="space-y-6">
        {FAQ_ITEMS.map((item) => (
          <article key={item.question} className="rounded-2xl border bg-card p-5 shadow-brand-sm sm:p-6">
            <h2 className="text-base font-semibold">{item.question}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
          </article>
        ))}
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
        <p className="text-lg font-semibold text-foreground">{FREE_PLAN_INFO.label}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{FREE_PLAN_INFO.description}</p>
        <Button asChild size="lg" className="mt-4">
          <Link href="/register">
            Gratis aan de slag
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
