import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";

import { AiLescoachButton } from "@/components/AiLescoachSheet";
import { ActivityDetailActions } from "@/components/activity-detail-actions";
import { ActivityImageLightbox } from "@/components/activity-image-lightbox";
import { DidacticsMatrix } from "@/components/didactics-matrix";
import { EmptyState } from "@/components/empty-state";
import { GameBasedPedagogyMatrix } from "@/components/GameBasedPedagogyMatrix";
import { LessonPdfButton } from "@/components/LessonPdfButton";
import { ShareLessonButton } from "@/components/ShareLessonButton";
import { SourceBadge } from "@/components/library-item-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCategoryColor } from "@/lib/constants/categoryColors";
import { formatDate, splitLearningOutcomeItems } from "@/lib/format";
import { getUserPermissions } from "@/lib/permissions";
import { getActivityById, isActivitySaved } from "@/lib/services/activities";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { DOELGROEP_LABELS, type Activity } from "@/types/activity";
import type { DidacticItem } from "@/types/lesson";

// Zelfde blauw/groen/rood-indeling voor de "3L's"/Leerhulp-weergave,
// ongeacht of dit een eenvoudige of via de wizard aangemaakte activiteit is.
const LEERHULP_COLORS = {
  loopt: { border: "border-blue-200", header: "bg-blue-50 text-blue-900" },
  lukt: { border: "border-green-200", header: "bg-green-50 text-green-900" },
  leeft: { border: "border-red-200", header: "bg-red-50 text-red-900" },
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

function LeerhulpCard({
  title,
  tips,
  colors,
}: {
  title: string;
  tips: string[] | null;
  colors: { border: string; header: string };
}) {
  return (
    <Card className={colors.border}>
      <CardHeader className={`rounded-t-xl ${colors.header}`}>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <TextList items={tips} />
      </CardContent>
    </Card>
  );
}

// Een activiteit die via de wizard is aangemaakt (met plattegrond, lesblokken,
// 3L's-analyse) heeft `arrangement` gevuld — de eenvoudige, oorspronkelijke
// bibliotheek-activiteiten hebben dat veld nooit. Die aanwezigheid bepaalt
// welke weergave deze ene detailpagina toont; zie
// supabase/migrations/consolidate_lessons_into_activiteiten.sql.
function isWizardActivity(activity: Activity): boolean {
  return activity.arrangement !== null;
}

export default async function ActiviteitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const activity = await getActivityById(id);

  if (!activity) {
    notFound();
  }

  const { hasFullLibraryAccess } = getUserPermissions(profile);
  const isOwnActivity = activity.author_id === profile.id;

  if (!hasFullLibraryAccess && !isOwnActivity && !activity.is_public) {
    return (
      <main className="mx-auto w-full max-w-4xl space-y-6 p-4 pb-28 md:p-8 md:pb-8">
        <Button asChild variant="outline">
          <Link href="/zoeken">
            <ArrowLeft className="size-4" />
            Terug naar Activiteiten
          </Link>
        </Button>
        <EmptyState
          icon={Lock}
          title="Bibliotheektoegang beperkt"
          description="Je hebt de maandelijkse bijdrage-eis niet gehaald, dus zie je alleen je eigen bijdragen. Maak en publiceer deze maand een activiteit via de wizard, of neem het betaalde abonnement voor volledige toegang."
          action={
            <Button asChild>
              <Link href="/les-maken">Naar de activiteit-maken wizard</Link>
            </Button>
          }
        />
      </main>
    );
  }

  const saved = await isActivitySaved(profile.id, activity.id);
  const wizardActivity = isWizardActivity(activity);

  const doelgroepLabels = (activity.doelgroep ?? [])
    .map((waarde) => DOELGROEP_LABELS[waarde])
    .filter((label): label is string => Boolean(label));
  const groepNiveauSummary = [
    activity.niveau !== null ? `Niveau ${activity.niveau}` : null,
    doelgroepLabels.length > 0 ? doelgroepLabels.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  let authorName: string | null = null;
  if (wizardActivity && activity.author_id) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: author } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("id", activity.author_id)
      .maybeSingle();
    authorName = author ? `${author.first_name} ${author.last_name}`.trim() : null;
  }

  const didacticItems = (activity.didactic_items ?? []) as DidacticItem[];
  const analyzePayload = {
    title: activity.titel,
    learningLine: activity.leerlijn ?? undefined,
    movementProblem: activity.movement_problem ?? undefined,
    movementTheme: activity.beweegthema ?? undefined,
    goals: activity.doel ?? undefined,
    didacticItems,
    gameCategory: activity.game_category ?? undefined,
    gameDimensions: activity.game_dimensions ?? undefined,
    tacticalQuestions: activity.tactical_questions ?? undefined,
  };

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 pb-28 md:p-8 md:pb-8 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline">
          <Link href="/zoeken">
            <ArrowLeft className="size-4" />
            Terug naar Bibliotheek
          </Link>
        </Button>
        {wizardActivity ? (
          <div className="hidden gap-2 md:flex">
            <AiLescoachButton payload={analyzePayload} />
            <LessonPdfButton activity={activity} authorName={authorName} />
            {isOwnActivity && (
              <ShareLessonButton
                lessonId={activity.id}
                lessonTitle={activity.titel}
                isOwner
                initialIsPublic={activity.is_public}
                isAiGenerated={activity.is_ai_generated}
              />
            )}
          </div>
        ) : (
          <div className="hidden md:block">
            <ActivityDetailActions activity={activity} initiallySaved={saved} />
          </div>
        )}
      </div>

      {/* Header — vast bovenaan */}
      <Card className="animate-fade-up">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <p
              className={`font-mono text-xs font-semibold tracking-[0.14em] uppercase ${getCategoryColor(activity.categorie).text}`}
            >
              {activity.categorie ?? "Activiteit"}
            </p>
            {activity.is_public ? (
              <SourceBadge source={activity.author_id ? "public" : "gymwiki"} />
            ) : (
              <SourceBadge source="gymwiki" />
            )}
          </div>
          <CardTitle className="mt-1 text-2xl">{activity.titel}</CardTitle>
          {wizardActivity && (
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {authorName && (
                <div>
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Docent
                  </dt>
                  <dd>{authorName}</dd>
                </div>
              )}
              {activity.activity_date && (
                <div>
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Datum
                  </dt>
                  <dd>{formatDate(activity.activity_date) ?? "-"}</dd>
                </div>
              )}
              {activity.group_name && (
                <div>
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Groep/klas
                  </dt>
                  <dd>{activity.group_name}</dd>
                </div>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {activity.leerlijn && <Badge variant="secondary">{activity.leerlijn}</Badge>}
            {activity.beweegthema && (
              <Badge variant="outline">{activity.beweegthema}</Badge>
            )}
            {activity.niveau && <Badge variant="outline">Niveau {activity.niveau}</Badge>}
            {doelgroepLabels.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Arrangement / plattegrond — vast bovenaan, boven de tab-balk */}
      <Card className="animate-fade-up" style={{ animationDelay: "40ms" }}>
        <CardHeader>
          <CardTitle>{wizardActivity ? "Plattegrond" : "Arrangement"}</CardTitle>
        </CardHeader>
        <CardContent>
          {wizardActivity ? (
            activity.diagram_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activity.diagram_image_url}
                alt="Plattegrond van het arrangement"
                className="w-full max-w-xl rounded-lg border"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Geen tekening toegevoegd.</p>
            )
          ) : (
            <ActivityImageLightbox src={activity.afbeelding} alt={activity.titel} />
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="lesinhoud" className="animate-fade-up" style={{ animationDelay: "80ms" }}>
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1">
          <TabsTrigger
            value="lesinhoud"
            className="px-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-2 sm:text-sm"
          >
            Lesinhoud & Regels
          </TabsTrigger>
          <TabsTrigger
            value="veld"
            className="px-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-2 sm:text-sm"
          >
            Veld & Materiaal
          </TabsTrigger>
          <TabsTrigger
            value="leerhulp"
            className="px-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-2 sm:text-sm"
          >
            Leerhulp
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Lesinhoud & Regels */}
        <TabsContent value="lesinhoud" className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <h3 className="mb-1 text-sm font-medium">Beginsituatie & Doelgroep</h3>
                {wizardActivity ? (
                  <p className="text-sm text-muted-foreground">
                    Aantal deelnemers — in het veld: {activity.min_participants ?? "-"} · op de
                    bank: {activity.participants_bench ?? "-"}
                  </p>
                ) : (
                  <>
                    {groepNiveauSummary && (
                      <p className="text-sm text-muted-foreground">{groepNiveauSummary}</p>
                    )}
                    <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
                      {activity.beginsituatie || "-"}
                    </p>
                  </>
                )}
              </div>
              <div>
                <h3 className="mb-1 text-sm font-medium">Doelstelling</h3>
                <p className="text-sm text-muted-foreground">{activity.doel || "-"}</p>
              </div>
              {activity.learning_outcomes && activity.learning_outcomes.length > 0 && (
                <div>
                  <h3 className="mb-1 text-sm font-medium">Leermogelijkheden / Leeruitkomsten</h3>
                  <NumberedList items={activity.learning_outcomes} />
                </div>
              )}
              {wizardActivity ? (
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
              ) : (
                <div>
                  <h3 className="mb-1 text-sm font-medium">Beschrijving</h3>
                  <p className="text-sm whitespace-pre-line text-muted-foreground">
                    {activity.beschrijving || "-"}
                  </p>
                </div>
              )}
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
                <h3 className="mb-1 text-sm font-medium">
                  {wizardActivity ? "Veldafmetingen & Veldopstelling" : "Veldafmetingen & Opstelling"}
                </h3>
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  {wizardActivity ? activity.arrangement || "-" : activity.veld || "-"}
                </p>
              </div>
              {wizardActivity ? (
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
              ) : (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Materiaallijst</h3>
                  <BadgeList items={activity.materiaal} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Leerhulp (3 L'en) */}
        <TabsContent value="leerhulp" className="space-y-4">
          {wizardActivity ? (
            <>
              <GameBasedPedagogyMatrix
                category={activity.game_category}
                dimensions={activity.game_dimensions}
                tacticalQuestions={activity.tactical_questions}
              />
              <DidacticsMatrix items={didacticItems} />
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <LeerhulpCard title="Loopt het?" tips={activity.loopt} colors={LEERHULP_COLORS.loopt} />
              <LeerhulpCard title="Lukt het?" tips={activity.lukt} colors={LEERHULP_COLORS.lukt} />
              <LeerhulpCard title="Leeft het?" tips={activity.leeft} colors={LEERHULP_COLORS.leeft} />
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="fixed inset-x-0 bottom-16 z-40 flex gap-2 border-t bg-card p-4 shadow-brand-lg md:hidden print:hidden">
        {wizardActivity ? (
          <>
            <AiLescoachButton payload={analyzePayload} className="flex-1" />
            <LessonPdfButton activity={activity} authorName={authorName} className="flex-1" />
            {isOwnActivity && (
              <ShareLessonButton
                lessonId={activity.id}
                lessonTitle={activity.titel}
                isOwner
                initialIsPublic={activity.is_public}
                isAiGenerated={activity.is_ai_generated}
                className="flex-1"
              />
            )}
          </>
        ) : (
          <ActivityDetailActions activity={activity} initiallySaved={saved} />
        )}
      </div>
    </main>
  );
}
