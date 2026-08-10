"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Anton } from "next/font/google";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});

type Feature = {
  tag: string;
  title: string;
  body: string;
};

const FEATURES: Feature[] = [
  {
    tag: "Modus",
    title: "Ontworpen voor elk licht",
    body: "Of je 's avonds laat thuis je lesvoorbereiding afmaakt of in het felle TL-licht van de sporthal snel iets wilt opzoeken: GymBase is gebouwd om overal leesbaar te blijven.",
  },
  {
    tag: "Lesopbouw",
    title: "De modulaire les-flow",
    body: "Geen eindeloze lappen tekst meer, maar visuele, intuïtieve blokken. Van je Arrangement tot de 4 L'en: je klikt je les in een handomdraai in elkaar.",
  },
  {
    tag: "Schets",
    title: "Plattegrond in één upload",
    body: "Voeg in een paar tikken een foto of schets van je arrangement toe aan je lesvoorbereiding — professioneel genoeg om direct in te leveren bij je praktijkbegeleider.",
  },
  {
    tag: "Export",
    title: "Instant A4 PDF-export",
    body: "Met één tik verandert jouw digitale lesvoorbereiding in een strak, officieel document dat voldoet aan de eisen van de hogeschool of schoolleiding.",
  },
  {
    tag: "Offline",
    title: "Offline-first PWA",
    body: "Geen internet in de gymzaal? De app blijft lokaal werken, zodat je lessen altijd en overal direct bij de hand hebt.",
  },
];

export default function LandingPage() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    // Defaults to light for SSR (server has no notion of the visitor's
    // local time), then adjusts once mounted — the standard hydration-safe
    // pattern for a client-only initial value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(hour >= 19 || hour < 7);
  }, []);

  return (
    <div
      className={cn(
        anton.variable,
        "min-h-screen font-sans transition-colors duration-500",
        isDark ? "bg-charcoal text-paper" : "bg-paper text-ink",
      )}
    >
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 sm:px-8">
        <span className="font-display text-xl tracking-wide">GYMBASE</span>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className={cn(
              "text-sm font-medium underline-offset-4 hover:underline",
              isDark ? "text-paper/80" : "text-ink/80",
            )}
          >
            Inloggen
          </Link>
          <button
            type="button"
            onClick={() => setIsDark((v) => !v)}
            aria-pressed={isDark}
            aria-label={
              isDark ? "Schakel naar sporthal-modus" : "Schakel naar avondmodus"
            }
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              isDark
                ? "border-paper/20 text-paper hover:bg-paper/10"
                : "border-ink/15 text-ink hover:bg-ink/5",
            )}
          >
            {isDark ? (
              <Moon className="size-3.5" />
            ) : (
              <Sun className="size-3.5" />
            )}
            {isDark ? "Avond" : "Sporthal"}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto w-full max-w-5xl overflow-hidden px-6 py-16 sm:px-8 sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-0 select-none"
        >
          <div className="absolute top-8 right-[-6rem] size-72 rotate-6 rounded-3xl border-4 border-cone/20 sm:size-96" />
          <div className="absolute -bottom-16 left-[-4rem] size-56 -rotate-3 rounded-3xl border-4 border-line-blue/15 sm:size-72" />
          <div className="absolute top-1/2 left-1/3 size-40 rotate-12 rounded-2xl border-4 border-court-yellow/20" />
        </div>

        <div className="relative z-10">
          <p
            className="animate-landing-rise font-mono text-xs font-medium tracking-[0.2em] text-cone uppercase"
            style={{ animationDelay: "0ms" }}
          >
            Geen Word-documenten. Geen printjes. Geen rommel.
          </p>
          <h1
            className="animate-landing-rise font-display mt-4 text-4xl leading-[0.95] tracking-tight sm:text-6xl md:text-7xl"
            style={{ animationDelay: "80ms" }}
          >
            DE NIEUWE STANDAARD IN BEWEGINGSONDERWIJS
          </h1>
          <p
            className={cn(
              "animate-landing-rise mt-6 max-w-xl text-base leading-relaxed sm:text-lg",
              isDark ? "text-paper/70" : "text-ink/70",
            )}
            style={{ animationDelay: "160ms" }}
          >
            Jouw lessen verdienen een interface die net zo strak, dynamisch en
            professioneel is als jij voor de klas staat. Ontwerp en beleef
            bewegingsonderwijs zoals het hoort: minimalistisch, razendsnel en
            ontworpen voor de praktijk.
          </p>
          <div
            className="animate-landing-rise mt-8 flex flex-wrap gap-3"
            style={{ animationDelay: "240ms" }}
          >
            <Link
              href="/dashboard"
              className="rounded-full bg-cone px-6 py-3 text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
            >
              Naar dashboard
            </Link>
            <Link
              href="/register"
              className={cn(
                "rounded-full border px-6 py-3 text-sm font-semibold transition-colors",
                isDark
                  ? "border-paper/25 text-paper hover:bg-paper/10"
                  : "border-ink/20 text-ink hover:bg-ink/5",
              )}
            >
              Account aanmaken
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-8 sm:py-16">
        <p className="font-mono text-xs font-medium tracking-[0.2em] text-cone uppercase">
          Wat onze UI/UX uniek maakt
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.tag}
              className={cn(
                "rounded-xl border-t-4 p-5 transition-transform hover:-translate-y-1",
                isDark ? "bg-paper/5" : "bg-ink/[0.03]",
                feature.tag === "Modus" || feature.tag === "Export"
                  ? "border-t-cone"
                  : feature.tag === "Lesopbouw" || feature.tag === "Offline"
                    ? "border-t-line-blue"
                    : "border-t-court-yellow",
              )}
            >
              <span className="font-mono text-[0.65rem] font-semibold tracking-[0.18em] text-cone uppercase">
                {feature.tag}
              </span>
              <h3 className="mt-2 text-base font-semibold">{feature.title}</h3>
              <p
                className={cn(
                  "mt-2 text-sm leading-relaxed",
                  isDark ? "text-paper/65" : "text-ink/65",
                )}
              >
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Closer */}
      <section className="bg-cone px-6 py-14 text-ink sm:px-8 sm:py-20">
        <div className="mx-auto w-full max-w-5xl">
          <p className="font-display text-2xl leading-tight sm:text-4xl">
            DIT IS NIET ZOMAAR EEN TOOL.
          </p>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink/80 sm:text-base">
            Dit is de go-to standaard voor de moderne bewegingsonderwijzer.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper transition-transform hover:scale-[1.03]"
          >
            Account aanmaken
          </Link>
        </div>
      </section>

      <footer
        className={cn(
          "mx-auto w-full max-w-5xl px-6 py-8 text-xs sm:px-8",
          isDark ? "text-paper/50" : "text-ink/50",
        )}
      >
        GymBase — gebouwd voor CALO-studenten en vakdocenten lichamelijke
        opvoeding.
      </footer>
    </div>
  );
}
