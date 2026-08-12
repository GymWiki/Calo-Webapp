import Link from "next/link";
import { EyeOff, Sparkles } from "lucide-react";

import { AiLescoachButton } from "@/components/AiLescoachSheet";
import { EmptyState } from "@/components/empty-state";
import { GameBasedPedagogyMatrix } from "@/components/GameBasedPedagogyMatrix";
import { LessonPdfButton } from "@/components/LessonPdfButton";
import { DidacticsMatrix } from "@/components/didactics-matrix";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import { getLessonById } from "@/lib/services/lessons";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { LESSON_BLOCK_LABELS } from "@/types/lesson";

// Zie de toelichting bij dezelfde constante in app/(protected)/les/[id]/page.tsx.
const LEERHULP_COLORS = {
  loopt_het: { border: "border-blue-200", header: "bg-blue-50 text-blue-900", emoji: "🔵" },
  lukt_het: { border: "border-green-200", header: "bg-green-50 text-green-900", emoji: "🟢" },
  leeft_het: { border: "border-red-200", header: "bg-red-50 text-red-900", emoji: "🔴" },
} as const;

function TextList({ items }: { items: string[] | null }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground">-</p>;
  }

  return (
    <ul className="space-y-1 text-sm">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>• {item}</li>
      ))}
    </ul>
  );
}

function NumberedList({ items }: { items: string[] | null }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ol>
  );
}

function BadgeList({ items }: { items: string[] | null }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground">-</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <Badge key={`${item}-${index}`} variant="secondary">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{value || "-"}</dd>
    </div>
  );
}

export default async function SharedLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [lesson, profile] = await Promise.all([
    getLessonById(id),
    getCurrentUserProfile(),
  ]);

  if (!lesson || !lesson.is_public) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
        <EmptyState
          icon={EyeOff}
          title="Deze les is niet (meer) beschikbaar"
          description="De link is verlopen of de les wordt niet langer openbaar gedeeld."
          action={
            <Button asChild>
              <Link href="/">Naar GymBase</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const authorName = lesson.author
    ? `${lesson.author.first_name} ${lesson.author.last_name}`.trim()
    : "Een GymBase-gebruiker";
  const dashboardHref =
    profile?.role === "docent" ? "/docent/dashboard" : "/student/dashboard";
  const blocksByType = new Map(
    lesson.lesson_blocks.map((block) => [block.block_type, block.content]),
  );
  const analyzePayload = {
    title: lesson.title,
    learningLine: lesson.learning_line ?? undefined,
    movementProblem: lesson.movement_problem ?? undefined,
    movementTheme: lesson.movement_theme ?? undefined,
    goals: lesson.goals ?? undefined,
    didacticItems: lesson.lesson_didactics?.items ?? [],
    gameCategory: lesson.game_category ?? undefined,
    gameDimensions: lesson.game_dimensions ?? undefined,
    tacticalQuestions: lesson.tactical_questions ?? undefined,
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-5 sm:px-8">
        <Link href="/" className="font-display text-lg tracking-wide">
          GYMBASE
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link href={profile ? dashboardHref : "/login"}>
            {profile ? "Naar mijn dashboard" : "Inloggen"}
          </Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-16 sm:px-8 sm:pb-10">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <Badge variant="secondary" className="mb-1.5">
            Gedeelde lesvoorbereiding
          </Badge>
          <p className="text-sm text-muted-foreground">
            Je bekijkt een openbaar gedeelde les van {authorName} op GymBase.
          </p>
        </div>

        <Card className="animate-fade-up">
          <CardHeader>
            <p className="font-mono text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              Lesvoorbereiding
            </p>
            <CardTitle className="mt-1 text-2xl">{lesson.title}</CardTitle>
            {lesson.learning_line && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary">{lesson.learning_line}</Badge>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <HeaderField label="Studentnaam" value={authorName} />
              <HeaderField label="Datum" value={formatDate(lesson.lesson_date) ?? "-"} />
              <HeaderField label="Groep/klas" value={lesson.group_name ?? "-"} />
              <HeaderField label="Bewegingsprobleem" value={lesson.movement_problem ?? "-"} />
              <HeaderField label="Bewegingsthema" value={lesson.movement_theme ?? "-"} />
            </dl>
          </CardContent>
        </Card>

        {/* Afbeelding / Plattegrond — vast bovenaan, boven de tab-balk */}
        <Card className="animate-fade-up" style={{ animationDelay: "40ms" }}>
          <CardHeader>
            <CardTitle>Plattegrond</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lesson.diagram_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lesson.diagram_image_url}
                alt="Plattegrond van het arrangement"
                className="w-full max-w-xl rounded-lg border"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Geen tekening toegevoegd.</p>
            )}
            <LessonPdfButton lesson={lesson} />
          </CardContent>
        </Card>

        {profile && (
          <div className="animate-fade-up flex justify-end" style={{ animationDelay: "60ms" }}>
            <AiLescoachButton payload={analyzePayload} />
          </div>
        )}

        <Tabs defaultValue="lesinhoud" className="animate-fade-up" style={{ animationDelay: "80ms" }}>
          <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
            <TabsTrigger value="lesinhoud">Lesinhoud & Regels</TabsTrigger>
            <TabsTrigger value="veld">Veld & Materiaal</TabsTrigger>
            <TabsTrigger value="leerhulp">Leerhulp</TabsTrigger>
          </TabsList>

          {/* Tab 1: Lesinhoud & Regels */}
          <TabsContent value="lesinhoud" className="space-y-4">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <h3 className="mb-1 text-sm font-medium">Beginsituatie & Doelgroep</h3>
                  <p className="text-sm text-muted-foreground">
                    Aantal deelnemers — in het veld: {lesson.min_participants ?? "-"} · op de
                    bank: {lesson.participants_bench ?? "-"}
                  </p>
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-medium">Doelstelling</h3>
                  <p className="text-sm text-muted-foreground">{lesson.goals ?? "-"}</p>
                </div>
                {lesson.learning_outcomes && lesson.learning_outcomes.length > 0 && (
                  <div>
                    <h3 className="mb-1 text-sm font-medium">Leeruitkomsten</h3>
                    <NumberedList items={lesson.learning_outcomes} />
                  </div>
                )}
                <div>
                  <h3 className="mb-2 text-sm font-medium">Beschrijving</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(["deelnemers_regels", "plaatje_praatje", "aandachtspunten"] as const).map(
                      (type) => (
                        <div key={type}>
                          <h4 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            {LESSON_BLOCK_LABELS[type]}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {blocksByType.get(type) || "-"}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium">Regels</h3>
                  <TextList items={lesson.rules} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Veld & Materiaal */}
          <TabsContent value="veld" className="space-y-4">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <h3 className="mb-1 text-sm font-medium">Veldafmetingen & Veldopstelling</h3>
                  <p className="text-sm text-muted-foreground">
                    {blocksByType.get("arrangement") || "-"}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Basismateriaal</h3>
                    <BadgeList items={lesson.base_materials} />
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Regelmateriaal</h3>
                    <BadgeList items={lesson.rule_materials} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Leerhulp (3 L'en) */}
          <TabsContent value="leerhulp" className="space-y-4">
            <GameBasedPedagogyMatrix
              category={lesson.game_category}
              dimensions={lesson.game_dimensions}
              tacticalQuestions={lesson.tactical_questions}
            />
            <DidacticsMatrix
              items={lesson.lesson_didactics?.items ?? []}
              styleOverrides={LEERHULP_COLORS}
            />
          </TabsContent>
        </Tabs>

        {!profile && (
          <Card className="animate-fade-up border-primary/40 bg-primary/5">
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <Sparkles className="size-6 text-primary" aria-hidden="true" />
              <p className="text-lg font-semibold">
                Maak zelf ook lesvoorbereidingen zoals deze
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                Sla deze les op &amp; maak je eigen lesvoorbereidingen op
                GymWiki — gratis voor CALO-studenten en vakdocenten.
              </p>
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/register">Sla deze les op &amp; begin gratis</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
