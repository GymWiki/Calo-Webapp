import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { LessonPdfButton } from "@/components/LessonPdfButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { getLessonById } from "@/lib/services/lessons";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import {
  L_QUESTIONS,
  LESSON_BLOCK_LABELS,
  LESSON_BLOCK_TYPES,
} from "@/types/lesson";

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

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-8 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline">
          <Link href={dashboardHref}>
            <ArrowLeft className="size-4" />
            Terug naar Dashboard
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {isOwner && (
            <Button type="button" variant="outline" disabled title="Binnenkort beschikbaar">
              <Pencil className="size-4" />
              Bewerken
            </Button>
          )}
          <LessonPdfButton lesson={lesson} />
        </div>
      </div>

      {/* Header */}
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

      {/* Sectie 1: Organisatie */}
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

      {/* Sectie 2: Didactische analyse (de 4 L'en) */}
      <Card className="animate-fade-up" style={{ animationDelay: "80ms" }}>
        <CardHeader>
          <CardTitle>Didactische analyse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="mb-1 text-sm font-medium">Doelen</h3>
            <p className="text-sm text-muted-foreground">{lesson.goals ?? "-"}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {L_QUESTIONS.map((question) => (
              <Card key={question.title} className="bg-muted/40">
                <CardHeader>
                  <CardTitle className="text-base">{question.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Wat zie je? </span>
                    {lesson.lesson_didactics?.[question.seeKey] || "-"}
                  </p>
                  <p>
                    <span className="font-medium">Wat doe je? </span>
                    {lesson.lesson_didactics?.[question.doKey] || "-"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sectie 3: Kernblokken */}
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

      {/* Tekening van het arrangement */}
      <Card className="animate-fade-up" style={{ animationDelay: "160ms" }}>
        <CardHeader>
          <CardTitle>Tekening van het arrangement</CardTitle>
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
            <p className="text-sm text-muted-foreground">
              Geen tekening toegevoegd.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
