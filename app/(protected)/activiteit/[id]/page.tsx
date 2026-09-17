import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Check, Lock, MapPin, Users } from "lucide-react";

import { ActivityDetailActions } from "@/components/activity-detail-actions";
import { ActivityImageLightbox } from "@/components/activity-image-lightbox";
import { ActivityInfoStrip, type InfoStripItem } from "@/components/activity-info-strip";
import { ActivityWizardPage } from "@/components/activity-wizard-page";
import { EmptyState } from "@/components/empty-state";
import { SourceBadge } from "@/components/library-item-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCategoryColor } from "@/lib/constants/categoryColors";
import { LEERHULP_COLORS } from "@/lib/constants/leerhulpColors";
import { splitLearningOutcomeItems } from "@/lib/format";
import {
  parseActivityDescription,
  splitIntoSteps,
  summarizeFirstParagraph,
} from "@/lib/activityDescription";
import { getUserPermissions } from "@/lib/permissions";
import { getActivityById, isActivitySaved } from "@/lib/services/activities";
import { getActivityKnowledgeSources } from "@/lib/services/knowledgeUsage";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { DOELGROEP_LABELS, type Activity } from "@/types/activity";
import type { DidacticItem } from "@/types/lesson";

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

// Verborgen i.p.v. een lege kaart met "-" tonen wanneer een activiteit voor
// deze L geen tips heeft — zie validatie-eis "lege secties netjes verborgen".
function LeerhulpCard({
  title,
  tips,
  colors,
}: {
  title: string;
  tips: string[] | null;
  colors: { border: string; header: string };
}) {
  if (!tips || tips.length === 0) return null;

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
// supabase/migrations/consolidate_lessons_into_activiteiten.sql. De
// wizard-weergave zelf staat in components/activity-wizard-page.tsx — dat
// is dezelfde component die "Zelf een activiteit maken" gebruikt in
// mode="edit", zie app/(protected)/les-maken/lesson-form.tsx.
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
      <main className="mx-auto w-full max-w-3xl space-y-6 p-4 pb-28 md:p-8 md:pb-8">
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

  // Wizard-activiteiten delen hun volledige weergave met de inline-editor
  // (zie components/activity-wizard-page.tsx: mode="view" hier, mode="edit"
  // in de "Zelf een activiteit maken"-pagina) — vandaar de vroege return.
  if (wizardActivity) {
    let authorName: string | null = null;
    if (activity.author_id) {
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
    const usedKnowledgeSources = await getActivityKnowledgeSources(activity.id);

    return (
      <main className="mx-auto w-full max-w-3xl space-y-5 p-4 pb-28 md:space-y-6 md:p-8 md:pb-24 print:max-w-none print:p-0">
        <ActivityWizardPage
          mode="view"
          activity={activity}
          title={activity.titel}
          learningLine={activity.leerlijn ?? ""}
          movementTheme={activity.beweegthema ?? ""}
          activityDate={activity.activity_date ?? ""}
          authorName={authorName}
          doelgroep={activity.doelgroep ?? []}
          minParticipants={activity.min_participants}
          participantsBench={activity.participants_bench}
          isPublic={activity.is_public}
          isOwnActivity={isOwnActivity}
          goals={activity.doel ?? ""}
          movementProblem={activity.movement_problem ?? ""}
          learningOutcomes={activity.learning_outcomes ?? []}
          deelnemersRegels={activity.deelnemers_regels ?? ""}
          plaatjePraatje={activity.plaatje_praatje ?? ""}
          aandachtspunten={activity.aandachtspunten ?? ""}
          regels={activity.regels ?? []}
          arrangement={activity.arrangement ?? ""}
          baseMaterials={activity.base_materials ?? []}
          ruleMaterials={activity.rule_materials ?? []}
          diagramImageUrl={activity.diagram_image_url}
          didacticItems={didacticItems}
          usedKnowledgeSources={usedKnowledgeSources}
        />
      </main>
    );
  }

  // Vanaf hier: alleen nog de eenvoudige-activiteit-weergave (arrangement,
  // beschrijving, loopt/lukt/leeft, ...).
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

  // Stap 1 (data) → stap 7/10 (weergave): "Deelnemers:"-blok uit de vrije
  // beschrijvingstekst lichten. Zie lib/activityDescription.ts voor de
  // onderbouwing op de volledige bibliotheek (203 activiteiten).
  const { participantsSummary, participantsDetail, bodyText } = parseActivityDescription(
    activity.beschrijving,
  );
  const inKort = summarizeFirstParagraph(bodyText);
  const speelStappen = splitIntoSteps(bodyText);

  const beginsituatieText = activity.beginsituatie;
  const hasBeginsituatieSection = Boolean(beginsituatieText) || doelgroepLabels.length > 0;

  const infoStripItems: InfoStripItem[] = [];
  if (participantsSummary) {
    infoStripItems.push({ icon: Users, label: participantsSummary });
  }
  if (activity.veld) {
    infoStripItems.push({ icon: MapPin, label: activity.veld });
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 p-4 pb-28 md:space-y-6 md:p-8 md:pb-24 print:max-w-none print:p-0">
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
          in de app: eyebrow + titel + meta, geen Card-wrapper). "In het
          kort" staat hier als dek (grotere, rustig lopende introductiezin)
          direct onder de titel — dat is de plek waar een docent binnen een
          paar seconden weet waar de activiteit over gaat, vóór er ook maar
          een kaart of tab in beeld komt. */}
      <div className="animate-fade-up space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={`font-mono text-xs font-semibold tracking-[0.14em] uppercase ${getCategoryColor(activity.categorie).text}`}
            >
              {activity.beweegthema || activity.categorie || "Activiteit"}
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight break-words sm:text-3xl">
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

        {inKort && (
          <p className="text-base leading-relaxed text-foreground/80 sm:text-lg">{inKort}</p>
        )}

        {infoStripItems.length > 0 && <ActivityInfoStrip items={infoStripItems} />}

        <div className="flex flex-wrap gap-1.5">
          {activity.leerlijn && <Badge variant="outline">{activity.leerlijn}</Badge>}
        </div>
      </div>

      {/* Eén kolom, altijd: afbeelding vol op de breedte van de pagina, dan
          de tabs eronder. Geen zijkolom en geen grid-split meer — op elke
          breedte dezelfde, voorspelbare leesvolgorde van boven naar
          beneden. */}
      <Card className="animate-fade-up" style={{ animationDelay: "40ms" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span
              className={`inline-block size-2.5 shrink-0 rounded-[3px] ${getCategoryColor(activity.categorie).dot}`}
              aria-hidden="true"
            />
            Arrangement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityImageLightbox
            src={activity.afbeelding}
            alt={activity.titel}
            emptyLabel="Geen arrangement-afbeelding beschikbaar."
          />
        </CardContent>
      </Card>

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

              {participantsDetail && (
                <div>
                  <SectionHeading>Deelnemers</SectionHeading>
                  <TextList items={participantsDetail} />
                </div>
              )}

              {/* Verborgen i.p.v. een lege "-" tonen wanneer er geen
                  beschrijving is ingevuld. */}
              {bodyText && (
                <div>
                  <SectionHeading>Zo speel je</SectionHeading>
                  {speelStappen ? (
                    <StepList steps={speelStappen} />
                  ) : (
                    <p className="text-sm whitespace-pre-line text-foreground">{bodyText}</p>
                  )}
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
                <SectionHeading>Veld &amp; opstelling</SectionHeading>
                <p className="text-sm whitespace-pre-line text-foreground">{activity.veld || "-"}</p>
              </div>
              <div>
                <SectionHeading>Materiaallijst</SectionHeading>
                <BadgeList items={activity.materiaal} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Leerhulp (3 L'en) — onder elkaar i.p.v. drie kolommen: bij
            langere tips-lijsten waren de kolommen te smal en brak de tekst
            ongemakkelijk af. Volle kaartbreedte binnen de pagina (die zelf
            al op een leesbare max-w-3xl staat) i.p.v. een extra kolomsplit. */}
        <TabsContent value="leerhulp" className="space-y-4">
          <div className="flex flex-col gap-4">
            <LeerhulpCard title="Loopt het?" tips={activity.loopt} colors={LEERHULP_COLORS.loopt} />
            <LeerhulpCard title="Lukt het?" tips={activity.lukt} colors={LEERHULP_COLORS.lukt} />
            <LeerhulpCard title="Leeft het?" tips={activity.leeft} colors={LEERHULP_COLORS.leeft} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Eén actiebalk, op elke breedte: vast onderaan het scherm,
          safe-area-bewust. bottom-[calc(4rem+env(safe-area-inset-bottom))]
          blijft boven de mobiele bottom-navigatie (md:hidden en zelf ook
          safe-area-bewust, zie components/app-layout.tsx), md:bottom-0
          daarna — op mobiel reserveert de nav er al onder de veilige zone. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex gap-2 border-t bg-card p-2.5 shadow-brand-lg md:bottom-0 md:pb-[calc(0.625rem+env(safe-area-inset-bottom))] print:hidden">
        <ActivityDetailActions activity={activity} initiallySaved={saved} />
      </div>
    </main>
  );
}
