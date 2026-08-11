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
import { formatDate } from "@/lib/format";
import { getLessonById } from "@/lib/services/lessons";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { LESSON_BLOCK_LABELS, LESSON_BLOCK_TYPES } from "@/types/lesson";

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
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <HeaderField label="Studentnaam" value={authorName} />
              <HeaderField label="Datum" value={formatDate(lesson.lesson_date) ?? "-"} />
              <HeaderField label="Groep/klas" value={lesson.group_name ?? "-"} />
              <HeaderField label="Leerlijn" value={lesson.learning_line ?? "-"} />
              <HeaderField label="Bewegingsprobleem" value={lesson.movement_problem ?? "-"} />
              <HeaderField label="Bewegingsthema" value={lesson.movement_theme ?? "-"} />
            </dl>
          </CardContent>
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: "40ms" }}>
          <CardHeader>
            <CardTitle>Organisatie</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium">Basismateriaal</h3>
              <BadgeList items={lesson.base_materials} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">Regelmateriaal</h3>
              <BadgeList items={lesson.rule_materials} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">Aantal deelnemers</h3>
              <p className="text-sm">
                In het veld: {lesson.min_participants ?? "-"} · Op de bank:{" "}
                {lesson.participants_bench ?? "-"}
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">Regels</h3>
              <TextList items={lesson.rules} />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: "80ms" }}>
          <CardHeader>
            <CardTitle>Didactische analyse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="mb-1 text-sm font-medium">Doelen</h3>
              <p className="text-sm text-muted-foreground">{lesson.goals ?? "-"}</p>
            </div>
            <DidacticsMatrix items={lesson.lesson_didactics?.items ?? []} />
          </CardContent>
        </Card>

        <GameBasedPedagogyMatrix
          category={lesson.game_category}
          dimensions={lesson.game_dimensions}
          tacticalQuestions={lesson.tactical_questions}
        />

        {profile && (
          <div className="animate-fade-up flex justify-end" style={{ animationDelay: "100ms" }}>
            <AiLescoachButton payload={analyzePayload} />
          </div>
        )}

        <Card className="animate-fade-up" style={{ animationDelay: "120ms" }}>
          <CardHeader>
            <CardTitle>Kernblokken</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {LESSON_BLOCK_TYPES.map((type) => (
              <Card key={type} className="bg-muted/40">
                <CardHeader>
                  <CardTitle className="text-base">
                    {LESSON_BLOCK_LABELS[type]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {blocksByType.get(type) || "-"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        <Card className="animate-fade-up" style={{ animationDelay: "160ms" }}>
          <CardHeader>
            <CardTitle>Tekening van het arrangement</CardTitle>
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
              <p className="text-sm text-muted-foreground">
                Geen tekening toegevoegd.
              </p>
            )}
            <LessonPdfButton lesson={lesson} />
          </CardContent>
        </Card>

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
