"use client";

import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";

import { AiLescoachButton, type AnalyzeLessonPayload } from "@/components/AiLescoachSheet";
import { ActivityImageLightbox } from "@/components/activity-image-lightbox";
import { DidacticsForm } from "@/components/DidacticsForm";
import { DidacticsMatrix } from "@/components/didactics-matrix";
import { EditableList } from "@/components/editable-list";
import { InlineEditText } from "@/components/inline-edit-text";
import { LessonPdfButton } from "@/components/LessonPdfButton";
import { SourceBadge } from "@/components/library-item-card";
import { ShareLessonButton } from "@/components/ShareLessonButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DiagramData } from "@/components/canvas/gym-canvas-types";
import { getCategoryColor } from "@/lib/constants/categoryColors";
import { BEWEGINGSTHEMAS, LEARNING_LINE_CATEGORIES } from "@/lib/constants/learningLines";
import { LEERHULP_DIDACTIC_STYLE_OVERRIDES } from "@/lib/constants/leerhulpColors";
import { formatDate, splitLearningOutcomeItems } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DOELGROEP_LABELS, DOELGROEP_WAARDEN, type Activity } from "@/types/activity";
import type { DidacticItem } from "@/types/lesson";
import { DiagramEditorCard } from "@/app/(protected)/les-maken/diagram-editor-card";

const IMPORT_FLAG_CLASS = "border-amber-400 ring-1 ring-amber-300/70 focus-visible:ring-amber-400";

// Rustige, kleine tekst naast de voortgangsbalk — geen toast per commit; een
// structureel falende autosave (meerdere mislukkingen op rij) krijgt wél een
// aparte, zichtbare toast (zie lesson-form.tsx's FAILURE_TOAST_THRESHOLD).
const SAVE_STATUS_LABELS: Record<"saving" | "saved" | "error", string> = {
  saving: "Bezig met opslaan...",
  saved: "Concept opgeslagen",
  error: "Opslaan mislukt",
};

// Wizard-activiteiten hebben geen eigen `categorie`-kolom (die is alleen
// gevuld voor eenvoudige activiteiten) — de eyebrow/plattegrond-stip vielen
// daardoor altijd terug op de grijze "Overig"-kleur, in zowel de bestaande
// weergave als hier. Bewust niet "verbeterd" naar een per-leerlijn-kleur:
// dat zou mode="edit" en mode="view" net van elkaar laten afwijken, precies
// de "verrassing" die de brief wil voorkomen.
const WIZARD_CATEGORY_COLOR = getCategoryColor(null);

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

// Één component, twee modi: `mode="view"` is de read-only
// activiteit-detailweergave voor wizard-activiteiten, `mode="edit"` is
// dezelfde lay-out/volgorde/kleuren maar dan met inline-bewerkbare velden —
// gebruikt door zowel "Zelf een activiteit maken" als de review-stap na
// Upload/AI-generatie (die hetzelfde formulier vullen). Omlijning, volgorde,
// secties en kleuren zijn identiek; het enige verschil is platte tekst vs.
// invoervelden, en de actiebalk (Bewaren/Kopieer/PDF vs. Opslaan) — die
// laatste kan niet gelijk zijn, want in edit-modus bestaat er nog geen
// opgeslagen activiteit-rij om te delen of te exporteren.
export function ActivityWizardPage({
  mode,
  activity,
  defaultTab = "lesinhoud",

  title,
  onTitleChange,
  titleFlagged,
  learningLine,
  onLearningLineChange,
  learningLineFlagged,
  movementTheme,
  onMovementThemeChange,
  movementThemeFlagged,
  groupName,
  onGroupNameChange,
  groupNameFlagged,
  activityDate,
  onActivityDateChange,
  authorName,
  doelgroep,
  onToggleDoelgroep,
  minParticipants,
  onMinParticipantsChange,
  participantsBench,
  onParticipantsBenchChange,
  isPublic,
  isOwnActivity,

  goals,
  onGoalsChange,
  goalsFlagged,
  movementProblem,
  onMovementProblemChange,
  movementProblemFlagged,
  learningOutcomes,
  onLearningOutcomesChange,
  deelnemersRegels,
  onDeelnemersRegelsChange,
  deelnemersRegelsFlagged,
  plaatjePraatje,
  onPlaatjePraatjeChange,
  plaatjePraatjeFlagged,
  aandachtspunten,
  onAandachtspuntenChange,
  aandachtspuntenFlagged,
  regels,
  onRegelsChange,

  arrangement,
  onArrangementChange,
  arrangementFlagged,
  baseMaterials,
  onBaseMaterialsChange,
  ruleMaterials,
  onRuleMaterialsChange,
  diagramImageUrl,
  onDiagramExport,

  didacticItems,
  onDidacticItemsChange,

  onCommit,
  saveStatus,
  analyzePayload,
  isSubmitting,
  filledCount,
  sectionCount,
}: {
  mode: "view" | "edit";
  /** Alleen nodig in mode="view" — voor LessonPdfButton, dat de volledige rij verwacht. */
  activity?: Activity;
  /** Welke tab standaard open staat — gebruikt door de "Zaal-Plattegrond
   * Tekenen"-snelkoppeling op het dashboard, die direct bij "Materiaal"
   * (waar de plattegrondtekenaar in mode="edit" staat) wil uitkomen. */
  defaultTab?: "lesinhoud" | "materiaal" | "leerhulp";

  title: string;
  onTitleChange?: (value: string) => void;
  titleFlagged?: boolean;
  learningLine: string;
  onLearningLineChange?: (value: string) => void;
  learningLineFlagged?: boolean;
  movementTheme: string;
  onMovementThemeChange?: (value: string) => void;
  movementThemeFlagged?: boolean;
  groupName: string;
  onGroupNameChange?: (value: string) => void;
  groupNameFlagged?: boolean;
  activityDate: string;
  onActivityDateChange?: (value: string) => void;
  authorName: string | null;
  doelgroep: number[];
  onToggleDoelgroep?: (waarde: number) => void;
  minParticipants: number | null;
  onMinParticipantsChange?: (value: number | undefined) => void;
  participantsBench: number | null;
  onParticipantsBenchChange?: (value: number | undefined) => void;
  isPublic: boolean;
  isOwnActivity: boolean;

  goals: string;
  onGoalsChange?: (value: string) => void;
  goalsFlagged?: boolean;
  movementProblem: string;
  onMovementProblemChange?: (value: string) => void;
  movementProblemFlagged?: boolean;
  learningOutcomes: string[];
  onLearningOutcomesChange?: (items: string[]) => void;
  deelnemersRegels: string;
  onDeelnemersRegelsChange?: (value: string) => void;
  deelnemersRegelsFlagged?: boolean;
  plaatjePraatje: string;
  onPlaatjePraatjeChange?: (value: string) => void;
  plaatjePraatjeFlagged?: boolean;
  aandachtspunten: string;
  onAandachtspuntenChange?: (value: string) => void;
  aandachtspuntenFlagged?: boolean;
  regels: string[];
  onRegelsChange?: (items: string[]) => void;

  arrangement: string;
  onArrangementChange?: (value: string) => void;
  arrangementFlagged?: boolean;
  baseMaterials: string[];
  onBaseMaterialsChange?: (items: string[]) => void;
  ruleMaterials: string[];
  onRuleMaterialsChange?: (items: string[]) => void;
  diagramImageUrl: string | null;
  onDiagramExport?: (data: DiagramData, imageDataUrl: string) => void;

  didacticItems: DidacticItem[];
  onDidacticItemsChange?: (items: DidacticItem[]) => void;

  /** Gedeeld door alle bewerkbare velden — bij elke commit (blur/wijziging)
   * wordt het hele concept opnieuw opgeslagen; welk veld het was, doet er
   * niet toe. Alleen relevant in mode="edit". */
  onCommit?: () => void;
  /** Onopvallende concept-opslagstatus naast de voortgangsbalk — alleen
   * relevant in mode="edit". Een structureel falende autosave krijgt een
   * eigen toast (zie lesson-form.tsx); dit is puur de rustige "bezig.../
   * opgeslagen"-indicatie voor het normale geval. */
  saveStatus?: "idle" | "saving" | "saved" | "error";
  analyzePayload: AnalyzeLessonPayload;
  isSubmitting?: boolean;
  filledCount?: number;
  sectionCount?: number;
}) {
  const isEdit = mode === "edit";
  // Bewegingsthema is een verfijning BINNEN de gekozen leerlijn (zie
  // lib/constants/learningLines.ts) — alleen tonen als een select wanneer er
  // voor deze leerlijn een gecorroboreerde thema-lijst bestaat; anders is er
  // geen apart, los invulbaar tekstveld meer (dat was precies het probleem
  // met het oude model) en valt de weergave terug op de leerlijn zelf.
  const themeOptions = BEWEGINGSTHEMAS[learningLine] ?? [];
  const doelgroepLabels = doelgroep.map((waarde) => DOELGROEP_LABELS[waarde]).filter(Boolean);
  const groepNiveauSummary = [movementTheme, doelgroepLabels.length > 0 ? doelgroepLabels.join(", ") : null]
    .filter(Boolean)
    .join(" · ");
  const hasBeginsituatieSection = Boolean(movementProblem) || doelgroepLabels.length > 0;
  const normalizedLearningOutcomes = splitLearningOutcomeItems(learningOutcomes);

  return (
    <>
      <div className="print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
          <Link href="/zoeken">
            <ArrowLeft className="size-4" />
            Bibliotheek
          </Link>
        </Button>
      </div>

      {/* Header — zelfde patroon als de eenvoudige-activiteit-weergave:
          eyebrow + titel + meta, geen kaart-omlijning. */}
      <div className="animate-fade-up space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isEdit ? (
              <select
                value={learningLine}
                onChange={(event) => {
                  onLearningLineChange?.(event.target.value);
                  onCommit?.();
                }}
                className={cn(
                  "h-auto border-none bg-transparent p-0 pr-6 font-mono text-xs font-semibold tracking-[0.14em] uppercase shadow-none",
                  WIZARD_CATEGORY_COLOR.text,
                  learningLineFlagged && "text-amber-600",
                )}
              >
                <option value="" disabled>
                  Kies een leerlijn
                </option>
                {LEARNING_LINE_CATEGORIES.map(({ category: cat, lines }) => (
                  <optgroup key={cat} label={cat}>
                    {lines.map((line) => (
                      <option key={line} value={line}>
                        {line}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : (
              <p className={cn("font-mono text-xs font-semibold tracking-[0.14em] uppercase", WIZARD_CATEGORY_COLOR.text)}>
                {movementTheme || learningLine || "Activiteit"}
              </p>
            )}

            {isEdit ? (
              <input
                value={title}
                onChange={(event) => onTitleChange?.(event.target.value)}
                onBlur={() => onCommit?.()}
                placeholder="Titel van de activiteit"
                className={cn(
                  "mt-0.5 w-full border-none bg-transparent p-0 text-2xl font-bold tracking-tight break-words outline-none placeholder:font-normal placeholder:text-muted-foreground sm:text-3xl",
                  titleFlagged && "text-amber-600",
                )}
              />
            ) : (
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight break-words sm:text-3xl">{title}</h1>
            )}

            {isEdit ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {themeOptions.length > 0 && (
                  <select
                    value={themeOptions.includes(movementTheme) ? movementTheme : ""}
                    onChange={(event) => {
                      onMovementThemeChange?.(event.target.value);
                      onCommit?.();
                    }}
                    className={cn(
                      "border-input flex h-10 w-auto max-w-40 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      movementThemeFlagged && IMPORT_FLAG_CLASS,
                    )}
                  >
                    <option value="" disabled>
                      Bewegingsthema
                    </option>
                    {themeOptions.map((theme) => (
                      <option key={theme} value={theme}>
                        {theme}
                      </option>
                    ))}
                  </select>
                )}
                <Input
                  value={groupName}
                  onChange={(event) => onGroupNameChange?.(event.target.value)}
                  onBlur={() => onCommit?.()}
                  placeholder="Groep/klas"
                  className={cn("h-10 w-auto max-w-36 text-sm", groupNameFlagged && IMPORT_FLAG_CLASS)}
                />
                <Input
                  type="date"
                  value={activityDate}
                  onChange={(event) => onActivityDateChange?.(event.target.value)}
                  onBlur={() => onCommit?.()}
                  className="h-10 w-auto text-sm"
                />
              </div>
            ) : (
              groepNiveauSummary && <p className="mt-1 text-sm text-muted-foreground">{groepNiveauSummary}</p>
            )}
          </div>
          {!isEdit && (
            <SourceBadge source={activity?.author_id ? (isPublic ? "public" : "gymwiki") : "gymwiki"} className="mt-1 shrink-0" />
          )}
        </div>

        {(isEdit || authorName || activityDate || minParticipants !== null || participantsBench !== null) && (
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {(isEdit || authorName) && (
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Docent</dt>
                <dd>{authorName ?? "-"}</dd>
              </div>
            )}
            {!isEdit && activityDate && (
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Datum</dt>
                <dd>{formatDate(activityDate) ?? "-"}</dd>
              </div>
            )}
            {(isEdit || minParticipants !== null) && (
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">In het veld</dt>
                {isEdit ? (
                  <Input
                    type="number"
                    min={0}
                    value={minParticipants ?? ""}
                    onChange={(event) =>
                      onMinParticipantsChange?.(event.target.value === "" ? undefined : Number(event.target.value))
                    }
                    onBlur={() => onCommit?.()}
                    className="mt-0.5 h-10 w-20 text-sm"
                  />
                ) : (
                  <dd>{minParticipants ?? "-"}</dd>
                )}
              </div>
            )}
            {(isEdit || participantsBench !== null) && (
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Op de bank</dt>
                {isEdit ? (
                  <Input
                    type="number"
                    min={0}
                    value={participantsBench ?? ""}
                    onChange={(event) =>
                      onParticipantsBenchChange?.(event.target.value === "" ? undefined : Number(event.target.value))
                    }
                    onBlur={() => onCommit?.()}
                    className="mt-0.5 h-10 w-20 text-sm"
                  />
                ) : (
                  <dd>{participantsBench ?? "-"}</dd>
                )}
              </div>
            )}
          </div>
        )}

        {(isEdit || doelgroepLabels.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {isEdit
              ? DOELGROEP_WAARDEN.map((waarde) => {
                  const active = doelgroep.includes(waarde);
                  return (
                    <button
                      key={waarde}
                      type="button"
                      onClick={() => {
                        onToggleDoelgroep?.(waarde);
                        onCommit?.();
                      }}
                      className={
                        active
                          ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                          : "rounded-full border px-3 py-1.5 text-sm text-muted-foreground"
                      }
                    >
                      {DOELGROEP_LABELS[waarde]}
                    </button>
                  );
                })
              : doelgroepLabels.map((label) => (
                  <Badge key={label} variant="secondary">
                    {label}
                  </Badge>
                ))}
          </div>
        )}

        {isEdit && typeof filledCount === "number" && typeof sectionCount === "number" && (
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300 ease-brand"
                style={{ width: `${(filledCount / sectionCount) * 100}%` }}
              />
            </div>
            {filledCount} van {sectionCount} secties ingevuld
            {saveStatus && saveStatus !== "idle" && (
              <span aria-live="polite" className="text-muted-foreground/70">
                · {SAVE_STATUS_LABELS[saveStatus]}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Plattegrond — vaste kaart, zelfde positie in beide modi: in
          mode="view" de geëxporteerde afbeelding, in mode="edit" de
          canvas-tekenaar zelf. */}
      <Card className="animate-fade-up" style={{ animationDelay: "40ms" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span
              className={cn("size-2.5 shrink-0 rounded-[3px]", WIZARD_CATEGORY_COLOR.dot)}
              aria-hidden="true"
            />
            Plattegrond
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEdit ? (
            <DiagramEditorCard
              onExport={(data, imageDataUrl) => {
                onDiagramExport?.(data, imageDataUrl);
                onCommit?.();
              }}
            />
          ) : (
            <ActivityImageLightbox
              src={diagramImageUrl}
              alt="Plattegrond van het arrangement"
              emptyLabel="Geen tekening toegevoegd."
            />
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue={defaultTab} className="animate-fade-up" style={{ animationDelay: "80ms" }}>
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

        {/* Tab 1: Lesinhoud — Doel, Beginsituatie & Doelgroep, Leeruitkomsten,
            Beschrijving/uitvoering, Regels. Volgorde en secties identiek aan
            de eenvoudige-activiteit-weergave. In mode="view" verdwijnt een
            volledig lege sectie i.p.v. een kale placeholder te tonen; in
            mode="edit" blijft elke sectie altijd zichtbaar (met de
            placeholder-hint), want anders is er niets om in te vullen. */}
        <TabsContent value="lesinhoud" className="space-y-4">
          <Card>
            <CardContent className="space-y-5 pt-6">
              {(isEdit || goals) && (
                <div>
                  <SectionHeading>Doel</SectionHeading>
                  {isEdit ? (
                    <InlineEditText
                      value={goals}
                      onChange={(value) => onGoalsChange?.(value)}
                      onCommit={onCommit}
                      placeholder="Wat leren leerlingen met deze activiteit?"
                      required
                      flagged={goalsFlagged}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-line text-foreground">{goals}</p>
                  )}
                </div>
              )}

              {(isEdit || hasBeginsituatieSection) && (
                <div>
                  <SectionHeading>Beginsituatie &amp; Doelgroep</SectionHeading>
                  {doelgroepLabels.length > 0 && (
                    <div className={movementProblem || isEdit ? "mb-2 flex flex-wrap gap-1.5" : "flex flex-wrap gap-1.5"}>
                      {doelgroepLabels.map((label) => (
                        <Badge key={label} variant="secondary">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {isEdit ? (
                    <InlineEditText
                      value={movementProblem}
                      onChange={(value) => onMovementProblemChange?.(value)}
                      onCommit={onCommit}
                      placeholder="Wat wordt verondersteld dat leerlingen al kunnen/hebben gedaan?"
                      required
                      flagged={movementProblemFlagged}
                    />
                  ) : (
                    movementProblem && (
                      <p className="text-sm whitespace-pre-line text-foreground">{movementProblem}</p>
                    )
                  )}
                </div>
              )}

              {(isEdit || normalizedLearningOutcomes.length > 0) && (
                <div>
                  <SectionHeading>Leeruitkomsten</SectionHeading>
                  {isEdit ? (
                    <EditableList
                      items={learningOutcomes}
                      onChange={(items) => onLearningOutcomesChange?.(items)}
                      onCommit={onCommit}
                      itemPlaceholder="Bijv. De leerling kan een bal onderhands overspelen"
                      addLabel="Voeg leeruitkomst toe"
                      emptyHint="Nog geen leeruitkomsten — voeg de eerste toe."
                    />
                  ) : (
                    <ol className="list-none space-y-2.5 pl-0">
                      {normalizedLearningOutcomes.map((item, index) => (
                        <li key={`${item}-${index}`} className="flex items-start gap-2.5 text-sm">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {index + 1}
                          </span>
                          <span className="text-foreground">{item}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <SectionHeading>Deelnemers &amp; Regels</SectionHeading>
                  {isEdit ? (
                    <InlineEditText
                      value={deelnemersRegels}
                      onChange={(value) => onDeelnemersRegelsChange?.(value)}
                      onCommit={onCommit}
                      placeholder="Rolinvulling: wie staat waar, wisselregels, scheidsrechters op de bank."
                      required
                      flagged={deelnemersRegelsFlagged}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-line text-foreground">{deelnemersRegels || "-"}</p>
                  )}
                </div>
                <div>
                  <SectionHeading>Plaatje &amp; Praatje</SectionHeading>
                  {isEdit ? (
                    <InlineEditText
                      value={plaatjePraatje}
                      onChange={(value) => onPlaatjePraatjeChange?.(value)}
                      onCommit={onCommit}
                      placeholder="Hoe de instructie visueel getoond wordt, hoe doelen worden uitgelegd en de wisselafspraken."
                      required
                      flagged={plaatjePraatjeFlagged}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-line text-foreground">{plaatjePraatje || "-"}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <SectionHeading>Aandachtspunten</SectionHeading>
                  {isEdit ? (
                    <InlineEditText
                      value={aandachtspunten}
                      onChange={(value) => onAandachtspuntenChange?.(value)}
                      onCommit={onCommit}
                      placeholder="Veiligheid, houding en tactiek."
                      required
                      flagged={aandachtspuntenFlagged}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-line text-foreground">{aandachtspunten || "-"}</p>
                  )}
                </div>
              </div>

              <div>
                <SectionHeading>Regels</SectionHeading>
                {isEdit ? (
                  <EditableList
                    items={regels}
                    onChange={(items) => onRegelsChange?.(items)}
                    onCommit={onCommit}
                    itemPlaceholder="Bijv. Geen slingerworpen"
                    addLabel="Voeg regel toe"
                    emptyHint="Nog geen regels genoteerd."
                  />
                ) : regels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Geen regels genoteerd.</p>
                ) : (
                  <ul className="space-y-2">
                    {regels.map((item, index) => (
                      <li key={`${item}-${index}`} className="flex items-start gap-2.5 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Materiaal (incl. veld/opstelling) */}
        <TabsContent value="materiaal" className="space-y-4">
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div>
                <SectionHeading>Veldafmetingen &amp; opstelling</SectionHeading>
                {isEdit ? (
                  <InlineEditText
                    value={arrangement}
                    onChange={(value) => onArrangementChange?.(value)}
                    onCommit={onCommit}
                    placeholder="De fysieke opstelling en het speelveld."
                    required
                    flagged={arrangementFlagged}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-line text-foreground">{arrangement || "-"}</p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <SectionHeading>Basismateriaal</SectionHeading>
                  {isEdit ? (
                    <EditableList
                      items={baseMaterials}
                      onChange={(items) => onBaseMaterialsChange?.(items)}
                      onCommit={onCommit}
                      itemPlaceholder="Bijv. 6 kleine matjes"
                      addLabel="Voeg materiaal toe"
                      emptyHint="Nog geen basismateriaal."
                    />
                  ) : baseMaterials.length === 0 ? (
                    <p className="text-sm text-muted-foreground">-</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {baseMaterials.map((item, index) => (
                        <Badge key={`${item}-${index}`} variant="secondary">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <SectionHeading>Regelmateriaal</SectionHeading>
                  {isEdit ? (
                    <EditableList
                      items={ruleMaterials}
                      onChange={(items) => onRuleMaterialsChange?.(items)}
                      onCommit={onCommit}
                      itemPlaceholder="Bijv. 4 foamballen"
                      addLabel="Voeg materiaal toe"
                      emptyHint="Nog geen regelmateriaal."
                    />
                  ) : ruleMaterials.length === 0 ? (
                    <p className="text-sm text-muted-foreground">-</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {ruleMaterials.map((item, index) => (
                        <Badge key={`${item}-${index}`} variant="secondary">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Leerhulp — de didactische 3L's-analyse, in dezelfde
            blauw/groen/rood-identiteit als de eenvoudige-activiteit-
            Leerhulp-kaarten (zie lib/constants/leerhulpColors.ts). */}
        <TabsContent value="leerhulp" className="space-y-4">
          {isEdit ? (
            <DidacticsForm
              items={didacticItems}
              onChange={(items) => {
                onDidacticItemsChange?.(items);
                onCommit?.();
              }}
              styleOverrides={LEERHULP_DIDACTIC_STYLE_OVERRIDES}
            />
          ) : (
            <DidacticsMatrix items={didacticItems} styleOverrides={LEERHULP_DIDACTIC_STYLE_OVERRIDES} />
          )}
        </TabsContent>
      </Tabs>

      {/* Eén actiebalk, op elke breedte: vast onderaan het scherm,
          safe-area-bewust. mode="view" toont de echte acties
          (AI-Lescoach/PDF/Delen), mode="edit" toont "Activiteit opslaan"
          (een echte submit-knop, binnen het <form> van de aanroeper) —
          dezelfde plek/omlijning, andere knoppen omdat er in edit-modus nog
          geen opgeslagen activiteit-rij is om te delen of te exporteren. */}
      <div className="fixed inset-x-0 bottom-16 z-40 flex items-center gap-2 border-t bg-card p-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-brand-lg md:bottom-0 print:hidden">
        {isEdit ? (
          <>
            <AiLescoachButton payload={analyzePayload} className="flex-1" />
            <Button type="submit" disabled={isSubmitting} className="flex-[1.4]">
              {isSubmitting ? "Bezig met opslaan..." : "Activiteit opslaan"}
            </Button>
          </>
        ) : (
          <>
            <AiLescoachButton payload={analyzePayload} className="flex-1" />
            {activity && <LessonPdfButton activity={activity} authorName={authorName} className="flex-1" />}
            {isOwnActivity && activity && (
              <ShareLessonButton
                lessonId={activity.id}
                lessonTitle={activity.titel}
                isOwner
                initialIsPublic={isPublic}
                isAiGenerated={activity.is_ai_generated}
                className="flex-1"
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
