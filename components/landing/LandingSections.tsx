import Link from "next/link";
import { ArrowRight, BookOpen, Box, CalendarDays, CircleCheck, Database, GraduationCap, SquarePen, Users, UsersRound, School, Backpack } from "lucide-react";

import { CountUp } from "@/components/landing/CountUp";
import { EditorMockup } from "@/components/landing/EditorMockup";
import { LandingActivityCard } from "@/components/landing/LandingActivityCard";
import { TrackedLink } from "@/components/landing/TrackedLink";
import { ScrollReveal } from "@/components/ScrollReveal";
import { PlanCard } from "@/components/subscription/PlanCard";
import { Button } from "@/components/ui/button";
import { audiences, editor, faq, features, finalCta, howItWorks, libraryPreview, links, pricing, problems, proof } from "@/content/landing.nl";
import type { LandingSnapshot } from "@/lib/services/landing";

function Heading({ eyebrow, title, id }: { eyebrow: string; title: string; id?: string }) {
  return (
    <ScrollReveal>
      <p className="font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase">{eyebrow}</p>
      <h2 id={id} className="font-display mt-3 max-w-2xl text-3xl leading-[1.05] tracking-tight sm:text-4xl">
        {title}
      </h2>
    </ScrollReveal>
  );
}

const sectionClass = "px-6 py-16 sm:px-8 sm:py-24";
const inner = "mx-auto w-full max-w-6xl";

export function ProblemSection() {
  return (
    <section className={`${sectionClass} border-y bg-muted/40`}>
      <div className={inner}>
        <Heading eyebrow={problems.eyebrow} title={problems.title} />
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {problems.items.map((item, index) => (
            <li key={item.title}>
              <ScrollReveal delayMs={index * 80} className="h-full">
                <div className="h-full rounded-2xl border bg-card p-6">
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </div>
              </ScrollReveal>
            </li>
          ))}
        </ul>
        <ScrollReveal delayMs={240}>
          <p className="mt-8 max-w-2xl text-base font-medium">{problems.solution}</p>
        </ScrollReveal>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section id={howItWorks.id} className={`${sectionClass} scroll-mt-20`}>
      <div className={inner}>
        <Heading eyebrow={howItWorks.eyebrow} title={howItWorks.title} />
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {howItWorks.steps.map((step, index) => (
            <li key={step.title}>
              <ScrollReveal delayMs={index * 80} className="h-full">
                <div className="h-full rounded-2xl border bg-card p-6">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span>
                  <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              </ScrollReveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const FEATURE_ICONS = { bibliotheek: BookOpen, maken: SquarePen, plattegrond: Box, kennisbank: Database, plannen: CalendarDays } as const;

export function FeatureSection({ activityCount }: { activityCount: number | null }) {
  return (
    <section className={`${sectionClass} border-y bg-muted/40`}>
      <div className={inner}>
        <Heading eyebrow={features.eyebrow} title={features.title} />
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.items.map((item, index) => {
            const Icon = FEATURE_ICONS[item.key as keyof typeof FEATURE_ICONS];
            const text = item.key === "bibliotheek" && activityCount ? `${activityCount} activiteiten. ${item.text}` : item.text;
            return (
              <li key={item.key}>
                <ScrollReveal delayMs={(index % 3) * 80} className="h-full">
                  <div className="group flex h-full flex-col rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-brand-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                    <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
                    {"href" in item && item.href && (
                      <Link href={item.href} className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">
                        {item.linkLabel} <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </ScrollReveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function EditorSection({ materialCount }: { materialCount: number | null }) {
  return (
    <section id={editor.id} className={`${sectionClass} scroll-mt-20`}>
      <div className={`${inner} grid items-center gap-10 lg:grid-cols-2 lg:gap-14`}>
        <div>
          <Heading eyebrow={editor.eyebrow} title={editor.title} />
          <ScrollReveal delayMs={80}>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">{editor.intro}</p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {editor.points.map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            {materialCount ? <p className="mt-4 text-sm text-muted-foreground">{materialCount} 3D-modellen in de bibliotheek.</p> : null}
            <Button asChild size="lg" className="mt-6 rounded-full px-7">
              <TrackedLink href={links.editor} event="landing_cta_editor" where="editor-sectie">
                {editor.cta} <ArrowRight className="size-4" aria-hidden="true" />
              </TrackedLink>
            </Button>
          </ScrollReveal>
        </div>
        <ScrollReveal delayMs={120}>
          <EditorMockup />
          <p className="mt-2 text-center text-xs text-muted-foreground">{editor.caption}</p>
        </ScrollReveal>
      </div>
    </section>
  );
}

const AUDIENCE_ICONS = [GraduationCap, Backpack, School, UsersRound] as const;

export function AudienceSection() {
  return (
    <section className={`${sectionClass} border-y bg-muted/40`}>
      <div className={inner}>
        <Heading eyebrow={audiences.eyebrow} title={audiences.title} />
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.items.map((item, index) => {
            const Icon = AUDIENCE_ICONS[index] ?? Users;
            return (
              <li key={item.title}>
                <ScrollReveal delayMs={index * 60} className="h-full">
                  <div className="h-full rounded-2xl border bg-card p-6">
                    <Icon className="size-6 text-primary" aria-hidden="true" />
                    <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                  </div>
                </ScrollReveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function LibraryPreviewSection({ snapshot }: { snapshot: LandingSnapshot }) {
  return (
    <section id={libraryPreview.id} className={`${sectionClass} scroll-mt-20`}>
      <div className={inner}>
        <Heading eyebrow={libraryPreview.eyebrow} title={libraryPreview.title} />
        {snapshot.preview.length > 0 ? (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {snapshot.preview.map((activity, index) => (
              <li key={activity.id}>
                <ScrollReveal delayMs={(index % 3) * 80} className="h-full">
                  <LandingActivityCard activity={activity} />
                </ScrollReveal>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground" data-testid="bibliotheek-leeg">
            {libraryPreview.empty}
          </p>
        )}
        <Button asChild variant="outline" size="lg" className="mt-8 rounded-full px-7">
          <TrackedLink href={links.library} event="landing_cta_bibliotheek" where="preview">
            {libraryPreview.linkLabel(snapshot.activityCount)} <ArrowRight className="size-4" aria-hidden="true" />
          </TrackedLink>
        </Button>
      </div>
    </section>
  );
}

export function PricingSection() {
  return (
    <section id={pricing.id} className={`${sectionClass} scroll-mt-20 border-y bg-muted/40`}>
      <div className={inner}>
        <Heading eyebrow={pricing.eyebrow} title={pricing.title} />
        <ScrollReveal delayMs={60}>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">{pricing.intro}</p>
        </ScrollReveal>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pricing.plans.map((plan, index) => (
            <ScrollReveal key={plan.cta} delayMs={index * 60} className="h-full">
              <PlanCard
                plan={plan.info}
                action={
                  <Button asChild className="w-full">
                    <Link href={plan.href}>{plan.cta}</Link>
                  </Button>
                }
              />
            </ScrollReveal>
          ))}
        </div>
        <ScrollReveal delayMs={120}>
          <p className="mt-6 max-w-3xl text-sm text-muted-foreground">
            {pricing.team}{" "}
            <Link href={pricing.teamCta.href} className="font-medium text-primary underline-offset-4 hover:underline">
              {pricing.teamCta.label}
            </Link>
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}

export function ProofSection({ snapshot }: { snapshot: LandingSnapshot }) {
  const stats = [
    { value: snapshot.activityCount, label: proof.labels.activities },
    { value: snapshot.leerlijnCount, label: proof.labels.leerlijnen },
    { value: snapshot.materialCount, label: proof.labels.materials },
  ].filter((stat): stat is { value: number; label: string } => typeof stat.value === "number" && stat.value > 0);
  if (stats.length === 0 && proof.testimonials.length === 0) return null;
  return (
    <section className={sectionClass} aria-labelledby="in-cijfers">
      <div className={inner}>
        <Heading eyebrow={proof.eyebrow} title={proof.title} id="in-cijfers" />
        <dl className="mt-10 grid grid-cols-1 gap-8 text-center sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dd className="font-display text-5xl tracking-tight text-primary">
                <CountUp value={stat.value} />
              </dd>
              <dt className="mt-1 text-sm text-muted-foreground">{stat.label}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-center text-xs text-muted-foreground">{proof.note}</p>
        {proof.testimonials.length > 0 && (
          <ul className="mt-10 grid gap-5 md:grid-cols-2">
            {proof.testimonials.map((t) => (
              <li key={t.name} className="rounded-2xl border bg-card p-6">
                <blockquote className="text-base">“{t.quote}”</blockquote>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t.name}, {t.role}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id={faq.id} className={`${sectionClass} scroll-mt-20 border-y bg-muted/40`}>
      <div className="mx-auto w-full max-w-3xl">
        <Heading eyebrow={faq.eyebrow} title={faq.title} />
        <div className="mt-10 divide-y rounded-2xl border bg-card">
          {faq.items.map((item) => (
            <details key={item.question} className="group p-5 open:bg-muted/30">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                {item.question}
                <span aria-hidden="true" className="text-xl leading-none text-primary transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none">+</span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCtaSection() {
  return (
    <section className="bg-primary px-6 py-14 text-primary-foreground sm:px-8 sm:py-20">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">{finalCta.title}</h2>
          <p className="mt-3 max-w-xl text-primary-foreground/90">{finalCta.text}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="rounded-full bg-background px-7 text-foreground hover:bg-background/90">
            <TrackedLink href={links.register} event="landing_cta_primair" where="slot">
              {finalCta.primary}
            </TrackedLink>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full border-primary-foreground/40 bg-transparent px-7 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
            <TrackedLink href={links.library} event="landing_cta_bibliotheek" where="slot">
              {finalCta.secondary}
            </TrackedLink>
          </Button>
        </div>
      </div>
    </section>
  );
}
