import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Coins,
  ListChecks,
  Sparkles,
  Target,
  Users2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LibraryItemCard } from "@/components/library-item-card";
import { ScrollReveal } from "@/components/ScrollReveal";
import { getLandingSnapshot } from "@/lib/services/landing";
import { cn } from "@/lib/utils";

// Publieke marketingpagina zonder gebruikerssessie — leest geen cookies, dus
// Next.js kan 'm statisch genereren en periodiek verversen i.p.v. bij elke
// bezoeker opnieuw naar Supabase te gaan. Eén uur is vaak genoeg: het
// activiteiten-aantal en de preview-kaarten hoeven niet live-live te zijn,
// zolang de pagina "automatisch actueel blijft" (zie de brief) naarmate de
// bibliotheek groeit.
export const revalidate = 3600;

const STEPS = [
  {
    icon: Users2,
    title: "Deel minstens 4 activiteiten per maand",
    body: "Draag actief bij aan de gezamenlijke bibliotheek en je hebt altijd volledige, gratis toegang tot alles wat anderen delen.",
  },
  {
    icon: Coins,
    title: "Of neem het abonnement — €3,- /maand",
    body: "Liever niet zelf bijdragen? Voor een klein bedrag per maand help je de collectieve bibliotheek in stand houden voor iedereen — zonder bijdrage-eis.",
  },
  {
    icon: BadgeCheck,
    title: "Een gecontroleerde, groeiende bibliotheek",
    body: "Elke inzending gaat langs een AI-kwaliteitscontrole vóór 'ie live gaat. Geen losse rommel — wel een betrouwbare bron die met elke bijdrage groeit.",
  },
] as const;

function PrimaryCta({ className }: { className?: string }) {
  return (
    <Button asChild size="lg" className={cn("rounded-full px-7", className)}>
      <Link href="/register">
        Gratis aan de slag
        <ArrowRight className="size-4" />
      </Link>
    </Button>
  );
}

/**
 * Illustratieve, schematische "activiteitkaart"-doorsnede — geen echte
 * database-rij, maar wél exact dezelfde drie kop-secties (Doel,
 * Beginsituatie & Doelgroep, Leeruitkomsten) als de echte detailpagina (zie
 * SectionHeading in app/(protected)/activiteit/[id]/page.tsx), zodat een
 * bezoeker die deze nog nooit heeft gezien meteen herkent dat het om
 * hetzelfde platform gaat zodra hij/zij een echte activiteit opent.
 */
function ActivityStructurePreview() {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-brand-md sm:p-6">
      <p className="font-mono text-[0.65rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        Voorbeeld — zo is elke activiteit opgebouwd
      </p>
      <p className="mt-1 text-sm font-semibold">Trefbal met vluchtheuvels</p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">Doel</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Leerlingen leren mikken, ontwijken en samen een tactiek kiezen binnen een veilige
            spelvorm.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">
            Beginsituatie &amp; doelgroep
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Groep 5-6 · kan al onderhands gooien en vangen, nog wisselend mikvaardig.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">
            Leeruitkomsten
          </p>
          <ol className="mt-1.5 space-y-1.5">
            {["Gericht mikken op een bewegend doel", "Ontwijken met behoud van spelinzicht", "Samen een vluchtheuvel-tactiek kiezen"].map(
              (item, index) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.65rem] font-semibold text-primary">
                    {index + 1}
                  </span>
                  {item}
                </li>
              ),
            )}
          </ol>
        </div>
      </div>
    </div>
  );
}

/**
 * Decoratieve, met SVG getekende "zaalvloer" — bewust geen stockfoto (zie de
 * brief) maar dezelfde belijnings-esthetiek als de canvas-editor zelf
 * (rechthoekige veldrand, middencirkel, boogvormige zone, spelers als
 * stippen — vergelijkbaar met de sportveld-presets in
 * components/canvas/field-presets.ts), puur decoratief dus aria-hidden.
 */
function HeroCourtIllustration() {
  return (
    <div className="relative aspect-4/3 w-full overflow-hidden rounded-3xl border border-ink/10 bg-charcoal shadow-brand-lg dark:border-paper/10">
      <svg viewBox="0 0 400 300" className="size-full" aria-hidden="true">
        <rect x="24" y="24" width="352" height="252" rx="16" fill="none" stroke="var(--line-blue)" strokeWidth="3" opacity="0.55" />
        <line x1="200" y1="24" x2="200" y2="276" stroke="var(--line-blue)" strokeWidth="2" opacity="0.35" />
        <circle cx="200" cy="150" r="42" fill="none" stroke="var(--court-yellow)" strokeWidth="3" strokeDasharray="7 7" opacity="0.8" />
        <path
          d="M 70 70 A 100 100 0 0 1 70 230"
          fill="none"
          stroke="var(--cone)"
          strokeWidth="3.5"
          opacity="0.85"
        />
        <path
          d="M 330 70 A 100 100 0 0 0 330 230"
          fill="none"
          stroke="var(--cone)"
          strokeWidth="3.5"
          opacity="0.5"
        />
        <circle cx="128" cy="96" r="8" fill="var(--cone)" />
        <circle cx="272" cy="204" r="8" fill="var(--line-blue)" />
        <circle cx="310" cy="90" r="8" fill="var(--court-yellow)" />
        <circle cx="96" cy="210" r="8" fill="var(--paper)" opacity="0.85" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-charcoal/90 to-transparent p-5">
        <p className="font-mono text-[0.65rem] font-medium tracking-[0.18em] text-paper/70 uppercase">
          Zo bouw je &apos;m zelf
        </p>
        <p className="mt-1 text-sm font-semibold text-paper">
          Plattegronden, sportveld-presets en materiaal — één canvas-editor per activiteit.
        </p>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  // Deze publieke pagina wordt statisch (her)gegenereerd (zie `revalidate`
  // hierboven) — als Supabase op dat moment onbereikbaar is of de
  // service-rol-sleutel ontbreekt, mag dat de build/generatie van de hele
  // pagina niet laten falen. De secties die van deze data afhangen
  // (activiteiten-teller, bibliotheek-preview) verbergen zichzelf simpelweg
  // wanneer de snapshot leeg is — de rest van de pagina blijft werken.
  const { activityCount, previewItems } = await getLandingSnapshot().catch(() => ({
    activityCount: null,
    previewItems: [],
  }));

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-8">
        <span className="font-display text-xl tracking-wide">GYMWIKI</span>
        <nav className="flex items-center gap-5">
          <a
            href="#hoe-het-werkt"
            className="hidden text-sm font-medium text-foreground/70 underline-offset-4 hover:text-foreground hover:underline sm:inline"
          >
            Hoe het werkt
          </a>
          <a
            href="#bibliotheek"
            className="hidden text-sm font-medium text-foreground/70 underline-offset-4 hover:text-foreground hover:underline sm:inline"
          >
            Bibliotheek
          </a>
          <Link
            href="/login"
            className="text-sm font-medium text-foreground/70 underline-offset-4 hover:text-foreground hover:underline"
          >
            Inloggen
          </Link>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/register">Aan de slag</Link>
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-10 pb-16 sm:px-8 sm:pt-14 sm:pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div className="animate-landing-rise" style={{ animationDelay: "0ms" }}>
            <p className="font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase">
              Door en voor vakleerkrachten LO
            </p>
            <h1 className="font-display mt-4 text-4xl leading-[0.98] tracking-tight sm:text-5xl md:text-6xl">
              Elk kind heeft recht op betekenisvol bewegingsonderwijs.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              GymWiki is de activiteitenbibliotheek die vakleerkrachten zelf bouwen, controleren
              en in stand houden — gebaseerd op het Basisdocument Bewegingsonderwijs, niet op
              losse, lukrake spelletjes.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PrimaryCta />
              <Button asChild size="lg" variant="outline" className="rounded-full px-7">
                <a href="#bibliotheek">Bekijk de bibliotheek</a>
              </Button>
            </div>
            <a
              href="#hoe-het-werkt"
              className="mt-6 inline-block text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Hoe werkt het collectieve model? ↓
            </a>
          </div>

          <div className="animate-landing-rise" style={{ animationDelay: "120ms" }}>
            <HeroCourtIllustration />
          </div>
        </div>
      </section>

      {/* Waarom GymWiki */}
      <section className="border-y bg-muted/40 px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto w-full max-w-6xl">
          <ScrollReveal>
            <p className="font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase">
              Waarom GymWiki bestaat
            </p>
            <h2 className="font-display mt-3 max-w-2xl text-3xl leading-[1.05] tracking-tight sm:text-4xl">
              Bewegingsonderwijs is meer dan een uurtje leuk spelen.
            </h2>
          </ScrollReveal>

          <div className="mt-10 grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
            <ScrollReveal delayMs={80}>
              <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
                <p>
                  Te veel bewegingsonderwijs bestaat uit losse, onsamenhangende activiteiten
                  achter elkaar — leuk voor dat moment, maar zonder opbouw naar écht leren
                  bewegen. Tegelijk heeft elk kind recht op goed bewegingsonderwijs, ongeacht wie
                  er voor de klas staat of hoeveel voorbereidingstijd er is.
                </p>
                <p>
                  GymWiki bestaat om dat verschil te maken: activiteiten die zijn opgebouwd rond
                  een expliciet doel, een reële beginsituatie en meetbare leeruitkomsten —
                  gebaseerd op het Basisdocument Bewegingsonderwijs, niet op een losse
                  Pinterest-vondst.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal delayMs={160}>
              <ActivityStructurePreview />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Hoe het platform werkt */}
      <section id="hoe-het-werkt" className="scroll-mt-20 px-6 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto w-full max-w-6xl">
          <ScrollReveal>
            <p className="font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase">
              Het collectieve model
            </p>
            <h2 className="font-display mt-3 max-w-2xl text-3xl leading-[1.05] tracking-tight sm:text-4xl">
              Gratis, zolang je meedoet.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              GymWiki wordt niet in stand gehouden door een investeerder, maar door de
              vakleerkrachten die het gebruiken. Wie meedoet aan de gezamenlijke bibliotheek,
              gebruikt het platform gratis. Wie dat niet kan of wil, betaalt een klein bedrag om
              diezelfde bibliotheek voor iedereen in stand te houden.
            </p>
          </ScrollReveal>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <ScrollReveal key={step.title} delayMs={index * 80}>
                <div className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-5 shadow-brand-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <step.icon className="size-5 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-semibold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {activityCount !== null && (
            <ScrollReveal delayMs={260}>
              <div className="mt-10 flex flex-col items-start gap-1 rounded-2xl border border-primary/25 bg-primary/5 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  <p className="text-sm font-medium">
                    <span className="font-display text-2xl tracking-tight">{activityCount}</span>{" "}
                    activiteiten in de bibliotheek — en groeiend, met elke bijdrage.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          )}
        </div>
      </section>

      {/* Bibliotheek-preview */}
      {previewItems.length > 0 && (
        <section id="bibliotheek" className="scroll-mt-20 border-t bg-muted/40 px-6 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto w-full max-w-6xl">
            <ScrollReveal>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase">
                    Een kijkje in de bibliotheek
                  </p>
                  <h2 className="font-display mt-3 text-3xl leading-[1.05] tracking-tight sm:text-4xl">
                    Wat je te wachten staat
                  </h2>
                </div>
                <Link
                  href="/zoeken"
                  className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Bekijk de volledige bibliotheek →
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={100}>
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {previewItems.map((item) => (
                  <LibraryItemCard key={`${item.source}-${item.id}`} item={item} />
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}

      {/* Missie-statement i.p.v. verzonnen cijfers/testimonials: er zijn nog
          te weinig actieve gebruikers in het systeem voor geloofwaardige
          social proof (zie de brief: "alleen toevoegen als er daadwerkelijk
          geloofwaardige content/cijfers voor zijn"). Dit blijft daarom
          bewust cijferloos. */}
      <section className="px-6 py-14 sm:px-8 sm:py-20">
        <ScrollReveal>
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 text-center">
            <Target className="size-6 text-primary" aria-hidden="true" />
            <p className="font-display text-2xl leading-tight tracking-tight sm:text-3xl">
              Gebouwd door vakleerkrachten, voor vakleerkrachten.
            </p>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              Geen anonieme contentfabriek — elke activiteit in de bibliotheek is ingebracht,
              gecontroleerd en gedeeld door mensen die zelf voor de klas staan.
            </p>
          </div>
        </ScrollReveal>
      </section>

      {/* Slot-CTA */}
      <section className="bg-primary px-6 py-14 text-primary-foreground sm:px-8 sm:py-20">
        <ScrollReveal>
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-2xl leading-tight sm:text-4xl">
                Klaar om betekenisvol bewegingsonderwijs vorm te geven?
              </p>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-primary-foreground/85 sm:text-base">
                Gratis zodra je meedoet aan de bibliotheek — of vanaf €3,- per maand als je liever
                niet zelf bijdraagt.
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="shrink-0 rounded-full bg-background px-7 text-foreground hover:bg-background/90"
            >
              <Link href="/register">
                Gratis aan de slag
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </ScrollReveal>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-col items-center gap-1 px-6 py-8 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
        <span>GymWiki — gebouwd voor CALO-studenten en vakdocenten lichamelijke opvoeding.</span>
        <span className="flex items-center gap-1.5">
          <ListChecks className="size-3.5" aria-hidden="true" />
          Elke bijdrage gaat langs een AI-kwaliteitscontrole.
        </span>
      </footer>
    </div>
  );
}
