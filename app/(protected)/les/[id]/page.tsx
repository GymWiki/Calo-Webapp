import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { AiLescoachButton } from "@/components/AiLescoachSheet";
import { GameBasedPedagogyMatrix } from "@/components/GameBasedPedagogyMatrix";
import { LessonPdfButton } from "@/components/LessonPdfButton";
import { DidacticsMatrix } from "@/components/didactics-matrix";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import { getLessonById } from "@/lib/services/lessons";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { LESSON_BLOCK_LABELS } from "@/types/lesson";

// Merkkleuren voor Tab 3 "Leerhulp" — bewust losgekoppeld van
// lib/didactics-styles.ts's CATEGORY_STYLES, die ook door de client-side
// didactiek-editor (les-maken) wordt gebruikt en dus niet stilzwijgend mee
// mag veranderen met deze detailpagina-specifieke kleurwens.
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

export default async function LesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const lesson = await getLessonById(id);

  if (!lesson) {
    notFound();
  }

  const isOwner = lesson.author_id === profile.id;
  const authorName = lesson.author
    ? `${lesson.author.first_name} ${lesson.author.last_name}`.trim()
    : "-";
  const dashboardHref =
    profile.role === "docent" ? "/docent/dashboard" : "/student/dashboard";
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
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 pb-28 sm:p-8 md:pb-8 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline">
          <Link href={dashboardHref}>
            <ArrowLeft className="size-4" />
            Terug naar Dashboard
          </Link>
        </Button>
        <div className="hidden gap-2 md:flex">
          {isOwner && (
            <Button type="button" variant="outline" disabled title="Binnenkort beschikbaar">
              <Pencil className="size-4" />
              Bewerken
            </Button>
          )}
          <AiLescoachButton payload={analyzePayload} />
          <LessonPdfButton lesson={lesson} />
        </div>
      </div>

      {/* Header — vast bovenaan */}
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
        <CardContent>
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
        </CardContent>
      </Card>

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

      <div className="fixed inset-x-0 bottom-16 z-40 flex gap-2 border-t bg-card p-4 shadow-brand-lg md:hidden print:hidden">
        {isOwner && (
          <Button
            type="button"
            variant="outline"
            disabled
            title="Binnenkort beschikbaar"
            className="flex-1"
          >
            <Pencil className="size-4" />
            Bewerken
          </Button>
        )}
        <AiLescoachButton payload={analyzePayload} className="flex-1" />
        <LessonPdfButton lesson={lesson} className="flex-1" />
      </div>
    </main>
  );
}
