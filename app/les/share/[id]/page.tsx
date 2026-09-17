import Link from "next/link";
import { EyeOff, Sparkles } from "lucide-react";

import { AiLescoachButton } from "@/components/AiLescoachSheet";
import { EmptyState } from "@/components/empty-state";
import { LessonPdfButton } from "@/components/LessonPdfButton";
import { DidacticsMatrix } from "@/components/didactics-matrix";
import { UsedSourcesList } from "@/components/UsedSourcesList";
import { LEERHULP_DIDACTIC_STYLE_OVERRIDES } from "@/lib/constants/leerhulpColors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, splitLearningOutcomeItems } from "@/lib/format";
import { getActivityById } from "@/lib/services/activities";
import { getActivityKnowledgeSources } from "@/lib/services/knowledgeUsage";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import type { DidacticItem } from "@/types/lesson";

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
  const normalized = splitLearningOutcomeItems(items);
  if (normalized.length === 0) {
    return null;
  }

  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm">
      {normalized.map((item, index) => (
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

export default async function SharedActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [activity, profile] = await Promise.all([
    getActivityById(id),
    getCurrentUserProfile(),
  ]);

  if (!activity || !activity.is_public || activity.arrangement === null) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
        <EmptyState
          icon={EyeOff}
          title="Deze activiteit is niet (meer) beschikbaar"
          description="De link is verlopen of de activiteit wordt niet langer openbaar gedeeld."
          action={
            <Button asChild>
              <Link href="/">Naar GymWiki</Link>
            </Button>
          }
        />
      </div>
    );
  }

  let authorName = "Een GymWiki-gebruiker";
  if (activity.author_id) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: author } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("id", activity.author_id)
      .maybeSingle();
    if (author) authorName = `${author.first_name} ${author.last_name}`.trim();
  }

  const usedKnowledgeSources = await getActivityKnowledgeSources(activity.id);

  const didacticItems = (activity.didactic_items ?? []) as DidacticItem[];
  const analyzePayload = {
    title: activity.titel,
    learningLine: activity.leerlijn ?? undefined,
    movementProblem: activity.movement_problem ?? undefined,
    movementTheme: activity.beweegthema ?? undefined,
    goals: activity.doel ?? undefined,
    didacticItems,
    // De route logt hiermee alleen daadwerkelijk iets (context='lescoach')
    // wanneer de huidige viewer ook de auteur is — zie de server-side
    // eigenaarschapscheck in analyze-lesson/route.ts. Voor elke andere
    // viewer van deze gedeelde pagina heeft dit veld gewoon geen effect.
    activityId: activity.id,
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-5 sm:px-8">
        <Link href="/" className="font-display text-lg tracking-wide">
          GYMWIKI
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link href={profile ? "/dashboard" : "/login"}>
            {profile ? "Naar mijn dashboard" : "Inloggen"}
          </Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-16 sm:px-8 sm:pb-10">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <Badge variant="secondary" className="mb-1.5">
            Gedeelde activiteit
          </Badge>
          <p className="text-sm text-muted-foreground">
            Je bekijkt een openbaar gedeelde activiteit van {authorName} op GymWiki.
          </p>
        </div>

        <Card className="animate-fade-up">
          <CardHeader>
            <p className="font-mono text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              Activiteit
            </p>
            <CardTitle className="mt-1 text-2xl">{activity.titel}</CardTitle>
            {activity.leerlijn && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary">{activity.leerlijn}</Badge>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <HeaderField label="Docent" value={authorName} />
              <HeaderField label="Datum" value={formatDate(activity.activity_date) ?? "-"} />
              <HeaderField label="Bewegingsprobleem" value={activity.movement_problem ?? "-"} />
              <HeaderField label="Bewegingsthema" value={activity.beweegthema ?? "-"} />
            </dl>
          </CardContent>
        </Card>

        {/* Afbeelding / Plattegrond — vast bovenaan, boven de tab-balk */}
        <Card className="animate-fade-up" style={{ animationDelay: "40ms" }}>
          <CardHeader>
            <CardTitle>Plattegrond</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activity.diagram_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activity.diagram_image_url}
                alt="Plattegrond van het arrangement"
                className="w-full max-w-xl rounded-lg border"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Geen tekening toegevoegd.</p>
            )}
            <LessonPdfButton activity={activity} authorName={authorName} />
          </CardContent>
        </Card>

        {profile && (
          <div className="animate-fade-up flex justify-end" style={{ animationDelay: "60ms" }}>
            <AiLescoachButton payload={analyzePayload} />
          </div>
        )}

        <Tabs defaultValue="lesinhoud" className="animate-fade-up" style={{ animationDelay: "80ms" }}>
          <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
            <TabsTrigger value="lesinhoud">Inhoud & Regels</TabsTrigger>
            <TabsTrigger value="veld">Veld & Materiaal</TabsTrigger>
            <TabsTrigger value="leerhulp">Leerhulp</TabsTrigger>
          </TabsList>

          {/* Tab 1: Inhoud & Regels */}
          <TabsContent value="lesinhoud" className="space-y-4">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <h3 className="mb-1 text-sm font-medium">Beginsituatie & Doelgroep</h3>
                  <p className="text-sm text-muted-foreground">
                    Aantal deelnemers — in het veld: {activity.min_participants ?? "-"} · op de
                    bank: {activity.participants_bench ?? "-"}
                  </p>
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-medium">Doelstelling</h3>
                  <p className="text-sm text-muted-foreground">{activity.doel ?? "-"}</p>
                </div>
                {activity.learning_outcomes && activity.learning_outcomes.length > 0 && (
                  <div>
                    <h3 className="mb-1 text-sm font-medium">Leeruitkomsten</h3>
                    <NumberedList items={activity.learning_outcomes} />
                  </div>
                )}
                <div>
                  <h3 className="mb-2 text-sm font-medium">Beschrijving</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <h4 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Deelnemers & Regels
                      </h4>
                      <p className="text-sm whitespace-pre-line text-muted-foreground">
                        {activity.deelnemers_regels || "-"}
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Plaatje & Praatje
                      </h4>
                      <p className="text-sm whitespace-pre-line text-muted-foreground">
                        {activity.plaatje_praatje || "-"}
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Aandachtspunten
                      </h4>
                      <p className="text-sm whitespace-pre-line text-muted-foreground">
                        {activity.aandachtspunten || "-"}
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium">Regels</h3>
                  <TextList items={activity.regels} />
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
                  <p className="text-sm whitespace-pre-line text-muted-foreground">{activity.arrangement || "-"}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Basismateriaal</h3>
                    <BadgeList items={activity.base_materials} />
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Regelmateriaal</h3>
                    <BadgeList items={activity.rule_materials} />
                  </div>
                </div>
                {usedKnowledgeSources.length > 0 && (
                  <UsedSourcesList chunks={usedKnowledgeSources} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Leerhulp (3 L'en) */}
          <TabsContent value="leerhulp" className="space-y-4">
            <DidacticsMatrix items={didacticItems} styleOverrides={LEERHULP_DIDACTIC_STYLE_OVERRIDES} />
          </TabsContent>
        </Tabs>

        {!profile && (
          <Card className="animate-fade-up border-primary/40 bg-primary/5">
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <Sparkles className="size-6 text-primary" aria-hidden="true" />
              <p className="text-lg font-semibold">Maak zelf ook activiteiten zoals deze</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Sla deze activiteit op &amp; maak je eigen activiteiten op GymWiki — gratis
                voor CALO-studenten en vakdocenten.
              </p>
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/register">Sla deze activiteit op &amp; begin gratis</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
