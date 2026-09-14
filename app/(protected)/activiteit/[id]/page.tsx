import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Check, Lock, MapPin, Target, Users } from "lucide-react";

import { AiLescoachButton } from "@/components/AiLescoachSheet";
import { ActivityDetailActions } from "@/components/activity-detail-actions";
import { ActivityImageLightbox } from "@/components/activity-image-lightbox";
import { ActivityInfoStrip, type InfoStripItem } from "@/components/activity-info-strip";
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
import {
  parseActivityDescription,
  splitIntoSteps,
  summarizeFirstParagraph,
} from "@/lib/activityDescription";
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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

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

// Genummerde cirkels i.p.v. platte tekst-achter-elkaar (was het gerapporteerde
// probleem) — puur visueel, de inhoud van elk item blijft woord voor woord
// hetzelfde. Geen "titel + beschrijving"-opsplitsing: de echte data bestaat
// uit complete zinnen zonder natuurlijke titel/beschrijving-breuk, dus dat
// zou een niet-bestaande structuur suggereren i.p.v. de bestaande content
// beter leesbaar maken.
function LearningOutcomesList({ items }: { items: string[] | null }) {
  const normalized = splitLearningOutcomeItems(items);
  if (normalized.length === 0) return null;

  return (
    <ol className="list-none space-y-2.5 pl-0">
      {normalized.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-start gap-2.5 text-sm">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {index + 1}
          </span>
          <span className="text-foreground">{item}</span>
        </li>
      ))}
    </ol>
  );
}

// Checklist-stijl voor regels ("✓ ...") i.p.v. een platte bullet-lijst —
// regels zijn dingen die een docent snel wil kunnen aftikken, zie brief.
function RulesChecklist({ items }: { items: string[] | null }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground">Geen regels genoteerd.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-start gap-2.5 text-sm">
          <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// Genummerde stappen ("01/02/03") voor een spelbeschrijving die zich daar
// natuurlijk voor leent (zie lib/activityDescription.ts's splitIntoSteps) —
// valt de aanroeper terug op gewone doorlopende tekst wanneer dat niet zo
// is, i.p.v. een stappenstructuur te forceren.
function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="list-none space-y-4 pl-0">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-0.5 shrink-0 font-mono text-xs font-semibold text-primary">
            {String(index + 1).padStart(2, "0")}
          </span>
          <p className="text-sm whitespace-pre-line text-foreground">{step}</p>
        </li>
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
      <main className="mx-auto w-full max-w-4xl space-y-6 p-4 pb-28 md:p-8 md:pb-8 lg:max-w-5xl">
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
    activity.categorie,
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

  // Stap 1 (data) → stap 7/10 (weergave): "Deelnemers:"-blok uit de vrije
  // beschrijvingstekst lichten (alleen voor eenvoudige activiteiten — de
  // wizard heeft hiervoor al de echte, structurele min/max-participantvelden
  // hieronder). Zie lib/activityDescription.ts voor de onderbouwing op de
  // volledige bibliotheek (203 activiteiten).
  const { participantsSummary, participantsDetail, bodyText } = wizardActivity
    ? { participantsSummary: null, participantsDetail: null, bodyText: "" }
    : parseActivityDescription(activity.beschrijving);
  // Wizard-activiteiten hebben geen eigen "In het kort" bron: hun enige
  // context-veld (movement_problem) staat nu voluit in de nieuwe
  // "Beginsituatie & Doelgroep"-sectie hieronder — dezelfde tekst nog eens
  // samengevat tonen zou puur herhaling zijn.
  const inKort = wizardActivity ? null : summarizeFirstParagraph(bodyText);
  const speelStappen = wizardActivity ? null : splitIntoSteps(bodyText);

  // Stap 3 van de brief: "Beginsituatie & Doelgroep" als context ná het doel
  // — voor eenvoudige activiteiten is dat het `beginsituatie`-veld, voor
  // wizard-activiteiten (die geen apart beginsituatie-veld invullen, zie
  // actions/lesson.ts) is `movement_problem` het dichtstbijzijnde bestaande
  // equivalent.
  const beginsituatieText = wizardActivity ? activity.movement_problem : activity.beginsituatie;
  const hasBeginsituatieSection = Boolean(beginsituatieText) || doelgroepLabels.length > 0;

  // Zijbalk-benodigdhedenlijst (stap "DESKTOP-LAYOUT VERBETEREN"): voor
  // wizard-activiteiten is dat basis- + regelmateriaal samen, voor
  // eenvoudige activiteiten de ene materiaallijst.
  const sidebarMateriaal = wizardActivity
    ? [...(activity.base_materials ?? []), ...(activity.rule_materials ?? [])]
    : (activity.materiaal ?? []);

  const infoStripItems: InfoStripItem[] = [];
  if (wizardActivity) {
    if (activity.min_participants !== null || activity.participants_bench !== null) {
      const parts = [
        activity.min_participants !== null ? `${activity.min_participants} in het veld` : null,
        activity.participants_bench !== null ? `${activity.participants_bench} op de bank` : null,
      ].filter(Boolean);
      infoStripItems.push({ icon: Users, label: parts.join(" · ") });
    }
    if (activity.movement_problem) {
      infoStripItems.push({ icon: Target, label: activity.movement_problem });
    }
  } else {
    if (participantsSummary) {
      infoStripItems.push({ icon: Users, label: participantsSummary });
    }
    if (activity.veld) {
      infoStripItems.push({ icon: MapPin, label: activity.veld });
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 pb-28 md:space-y-6 md:p-8 md:pb-8 lg:max-w-5xl xl:max-w-6xl print:max-w-none print:p-0">
      {/* Actieknoppen staan niet meer in deze topbalk — op mobiel/tablet
          zitten ze in de vaste onderbalk, op desktop (lg+) prominent
          bovenaan de sticky zijbalk (zie het grid verderop). */}
      <div className="print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
          <Link href="/zoeken">
            <ArrowLeft className="size-4" />
            Bibliotheek
          </Link>
        </Button>
      </div>

      {/* Header — titel is het belangrijkste element, geen kaart-omlijning
          nodig (zie components/page-header.tsx voor hetzelfde patroon elders
          in de app: eyebrow + titel + meta, geen Card-wrapper). */}
      <div className="animate-fade-up space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={`font-mono text-xs font-semibold tracking-[0.14em] uppercase ${getCategoryColor(activity.categorie).text}`}
            >
              {activity.beweegthema || activity.categorie || "Activiteit"}
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight break-words">
              {activity.titel}
            </h1>
            {groepNiveauSummary && (
              <p className="mt-1 text-sm text-muted-foreground">{groepNiveauSummary}</p>
            )}
          </div>
          {activity.is_public ? (
            <SourceBadge source={activity.author_id ? "public" : "gymwiki"} className="mt-1 shrink-0" />
          ) : (
            <SourceBadge source="gymwiki" className="mt-1 shrink-0" />
          )}
        </div>

        {wizardActivity && (
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
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

        {infoStripItems.length > 0 && <ActivityInfoStrip items={infoStripItems} />}

        <div className="flex flex-wrap gap-1.5">
          {activity.leerlijn && <Badge variant="outline">{activity.leerlijn}</Badge>}
          {wizardActivity && activity.beweegthema && (
            <Badge variant="outline">{activity.beweegthema}</Badge>
          )}
        </div>
      </div>

      {/* Twee kolommen vanaf lg: hoofdkolom (arrangement + tabs, leescontent)
          links, vaste sticky zijbalk (metadata op een oogopslag + acties)
          rechts. DOM-volgorde = hoofdkolom vóór zijbalk, dus leesvolgorde
          voor toetsenbord/screenreader blijft gelijk aan de visuele volgorde
          op elke breedte — geen `order`-trucs. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-8">
        {/* Arrangement staat vóór de tabs in de DOM — zo blijft de leesvolgorde
            voor toetsenbord/screenreader-gebruikers gelijk aan de visuele
            volgorde op mobiel (afbeelding boven de tabs). Op desktop plaatst
            het grid 'm in een vaste linkerkolom naast de tabs, puur visueel —
            geen `order`-trucs die leesvolgorde en visuele volgorde uit elkaar
            zouden trekken. */}
        <div className="grid gap-5 md:grid-cols-[20rem_1fr] md:items-start md:gap-6">
          <Card className="animate-fade-up" style={{ animationDelay: "40ms" }}>
            <CardHeader>
              <CardTitle className="text-base">
                {wizardActivity ? "Plattegrond" : "Arrangement"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {wizardActivity ? (
                <ActivityImageLightbox
                  src={activity.diagram_image_url}
                  alt="Plattegrond van het arrangement"
                  emptyLabel="Geen tekening toegevoegd."
                />
              ) : (
                <ActivityImageLightbox
                  src={activity.afbeelding}
                  alt={activity.titel}
                  emptyLabel="Geen arrangement-afbeelding beschikbaar."
                />
              )}
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-5 md:space-y-6">
            <Tabs defaultValue="lesinhoud" className="animate-fade-up" style={{ animationDelay: "80ms" }}>
              <TabsList className="sticky top-0 z-30 grid h-auto w-full grid-cols-3 gap-1 border bg-background/95 p-1 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
                <TabsTrigger
                  value="lesinhoud"
                  className="min-h-9 px-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-2 sm:text-sm"
                >
                  Lesinhoud
                </TabsTrigger>
                <TabsTrigger
                  value="materiaal"
                  className="min-h-9 px-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-2 sm:text-sm"
                >
                  Materiaal
                </TabsTrigger>
                <TabsTrigger
                  value="leerhulp"
                  className="min-h-9 px-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-2 sm:text-sm"
                >
                  Leerhulp
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Lesinhoud */}
              <TabsContent value="lesinhoud" className="space-y-4">
                {inKort && (
                  <Card>
                    <CardContent className="pt-6">
                      <SectionHeading>In het kort</SectionHeading>
                      <p className="text-sm text-foreground">{inKort}</p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardContent className="space-y-5 pt-6">
                    {/* Volgorde bewust: eerst het "waarom" (Doel), dan de context
                        waartegen dat doel staat (Beginsituatie & Doelgroep — voor
                        wie is dit, wat wordt al verondersteld), dán pas de
                        leeruitkomsten en de daadwerkelijke uitvoering. */}
                    {activity.doel && (
                      <div>
                        <SectionHeading>Doel</SectionHeading>
                        <p className="text-sm whitespace-pre-line text-foreground">{activity.doel}</p>
                      </div>
                    )}

                    {hasBeginsituatieSection && (
                      <div>
                        <SectionHeading>Beginsituatie &amp; Doelgroep</SectionHeading>
                        {doelgroepLabels.length > 0 && (
                          <div className={beginsituatieText ? "mb-2 flex flex-wrap gap-1.5" : "flex flex-wrap gap-1.5"}>
                            {doelgroepLabels.map((label) => (
                              <Badge key={label} variant="secondary">
                                {label}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {beginsituatieText && (
                          <p className="text-sm whitespace-pre-line text-foreground">
                            {beginsituatieText}
                          </p>
                        )}
                      </div>
                    )}

                    {activity.learning_outcomes && activity.learning_outcomes.length > 0 && (
                      <div>
                        <SectionHeading>Leeruitkomsten</SectionHeading>
                        <LearningOutcomesList items={activity.learning_outcomes} />
                      </div>
                    )}

                    {!wizardActivity && participantsDetail && (
                      <div>
                        <SectionHeading>Deelnemers</SectionHeading>
                        <TextList items={participantsDetail} />
                      </div>
                    )}

                    {/* Verborgen i.p.v. een lege "-" tonen wanneer er geen
                        beschrijving is ingevuld. */}
                    {!wizardActivity && bodyText && (
                      <div>
                        <SectionHeading>Zo speel je</SectionHeading>
                        {speelStappen ? (
                          <StepList steps={speelStappen} />
                        ) : (
                          <p className="text-sm whitespace-pre-line text-foreground">{bodyText}</p>
                        )}
                      </div>
                    )}

                    {wizardActivity && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <SectionHeading>Deelnemers &amp; Regels</SectionHeading>
                          <p className="text-sm whitespace-pre-line text-foreground">
                            {activity.deelnemers_regels || "-"}
                          </p>
                        </div>
                        <div>
                          <SectionHeading>Plaatje &amp; Praatje</SectionHeading>
                          <p className="text-sm whitespace-pre-line text-foreground">
                            {activity.plaatje_praatje || "-"}
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <SectionHeading>Aandachtspunten</SectionHeading>
                          <p className="text-sm whitespace-pre-line text-foreground">
                            {activity.aandachtspunten || "-"}
                          </p>
                        </div>
                      </div>
                    )}

                    <div>
                      <SectionHeading>Regels</SectionHeading>
                      <RulesChecklist items={activity.regels} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 2: Materiaal (incl. veld/opstelling) */}
              <TabsContent value="materiaal" className="space-y-4">
                <Card>
                  <CardContent className="space-y-5 pt-6">
                    <div>
                      <SectionHeading>
                        {wizardActivity ? "Veldafmetingen & opstelling" : "Veld & opstelling"}
                      </SectionHeading>
                      <p className="text-sm whitespace-pre-line text-foreground">
                        {wizardActivity ? activity.arrangement || "-" : activity.veld || "-"}
                      </p>
                    </div>
                    {wizardActivity ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <SectionHeading>Basismateriaal</SectionHeading>
                          <BadgeList items={activity.base_materials} />
                        </div>
                        <div>
                          <SectionHeading>Regelmateriaal</SectionHeading>
                          <BadgeList items={activity.rule_materials} />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <SectionHeading>Materiaallijst</SectionHeading>
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
          </div>
        </div>

        {/* Zijbalk — alleen vanaf lg, sticky zodat metadata + acties bij het
            scrollen door de (vaak langere) hoofdkolom in beeld blijven. Op
            mobiel/tablet blijven dezelfde acties bereikbaar via de vaste
            onderbalk verderop (lg:hidden). */}
        <aside className="hidden lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-3rem)] lg:space-y-4 lg:overflow-y-auto lg:pb-2 print:hidden">
          {wizardActivity ? (
            <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-brand-sm">
              <AiLescoachButton payload={analyzePayload} className="w-full" />
              <LessonPdfButton activity={activity} authorName={authorName} className="w-full" />
              {isOwnActivity && (
                <ShareLessonButton
                  lessonId={activity.id}
                  lessonTitle={activity.titel}
                  isOwner
                  initialIsPublic={activity.is_public}
                  isAiGenerated={activity.is_ai_generated}
                  className="w-full"
                />
              )}
            </div>
          ) : (
            <ActivityDetailActions activity={activity} initiallySaved={saved} />
          )}

          <Card>
            <CardContent className="space-y-4 pt-6">
              {activity.categorie && (
                <div>
                  <SectionHeading>Categorie</SectionHeading>
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <span
                      className={`inline-block size-2.5 shrink-0 rounded-[3px] ${getCategoryColor(activity.categorie).dot}`}
                      aria-hidden="true"
                    />
                    {activity.categorie}
                  </p>
                </div>
              )}

              {doelgroepLabels.length > 0 && (
                <div>
                  <SectionHeading>Groep</SectionHeading>
                  <div className="flex flex-wrap gap-1.5">
                    {doelgroepLabels.map((label) => (
                      <Badge key={label} variant="secondary">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {sidebarMateriaal.length > 0 && (
                <div>
                  <SectionHeading>Benodigdheden</SectionHeading>
                  <TextList items={sidebarMateriaal} />
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-40 flex gap-2 border-t bg-card p-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-brand-lg lg:hidden print:hidden">
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
