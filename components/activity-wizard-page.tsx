"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ImageOff, Loader2, MapPinned, Pencil } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DiagramData } from "@/components/canvas/gym-canvas-types";
import { getCategoryColor } from "@/lib/constants/categoryColors";
import { BEWEGINGSTHEMAS, LEARNING_LINE_CATEGORIES } from "@/lib/constants/learningLines";
import { LEERHULP_DIDACTIC_STYLE_OVERRIDES } from "@/lib/constants/leerhulpColors";
import { formatDate, splitLearningOutcomeItems } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DOELGROEP_LABELS, DOELGROEP_WAARDEN, type Activity } from "@/types/activity";
import { REQUIRED_LESSON_FIELDS, type DidacticItem } from "@/types/lesson";
import { FullscreenDiagramEditor } from "@/components/canvas/FullscreenDiagramEditor";

const IMPORT_FLAG_CLASS = "border-amber-400 ring-1 ring-amber-300/70 focus-visible:ring-amber-400";

type RequiredFieldKey = (typeof REQUIRED_LESSON_FIELDS)[number]["field"];

// Opzoekbaar per veldnaam — REQUIRED_LESSON_FIELDS zelf is een array (voor
// een voorspelbare volgorde in de missing-fields-lijst hieronder), maar
// jumpToField hieronder heeft O(1)-opzoek nodig.
const REQUIRED_FIELD_BY_KEY = new Map(REQUIRED_LESSON_FIELDS.map((entry) => [entry.field, entry]));

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

// Klein, consistent label BOVEN een veld (i.p.v. het te kleine/moeilijk
// leesbare mono-labeltje dat de leerlijn-select eerder had) + optionele
// helptekst eronder — zodat in één oogopslag duidelijk is wat een veld
// verwacht, ongeacht of het een select, input of chip-rij is.
function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Zelfde amber-toon als IMPORT_FLAG_CLASS (de rand) en InlineEditText's
// inline "Verplicht"-label — hier als apart tekstregeltje ONDER platte
// input/select-velden, die zelf geen ingebouwde manier hebben om een hint
// onder zich te tonen zoals InlineEditText dat al kan.
function RequiredFieldHint({ show }: { show?: boolean }) {
  if (!show) return null;
  return <p className="mt-1.5 text-xs font-medium text-amber-600">Dit veld is verplicht.</p>;
}

const SELECT_FIELD_CLASS =
  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

const DOELGROEP_CHIP_CLASS =
  "rounded-full border px-3 py-1.5 text-sm outline-none transition-[color,box-shadow,background-color,transform] duration-150 ease-brand focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.98]";

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
  activityDate,
  onActivityDateChange,
  activityDateFlagged,
  authorName,
  doelgroep,
  onToggleDoelgroep,
  minParticipants,
  onMinParticipantsChange,
  participantsBench,
  onParticipantsBenchChange,
  isPublic,
  isOwnActivity,
  publishToggle,
  onPublishToggleChange,

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
  diagramData,
  diagramImageUrl,
  onDiagramExport,

  didacticItems,
  onDidacticItemsChange,

  onCommit,
  saveStatus,
  analyzePayload,
  isSubmitting,
  missingFields,
  jumpToFieldTrigger,
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
  activityDate: string;
  onActivityDateChange?: (value: string) => void;
  activityDateFlagged?: boolean;
  authorName: string | null;
  doelgroep: number[];
  onToggleDoelgroep?: (waarde: number) => void;
  minParticipants: number | null;
  onMinParticipantsChange?: (value: number | undefined) => void;
  participantsBench: number | null;
  onParticipantsBenchChange?: (value: number | undefined) => void;
  isPublic: boolean;
  isOwnActivity: boolean;
  /** De "Delen in de gedeelde bibliotheek"-toggle — alleen relevant in
   * mode="edit" (vóór opslaan). Los van `isPublic` hierboven, dat de
   * WERKELIJKE status van een al opgeslagen activiteit toont in mode="view". */
  publishToggle?: boolean;
  onPublishToggleChange?: (value: boolean) => void;

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
  /** Ruwe canvas-state — nodig om de volledig-scherm editor te heropenen
   * met het bestaande arrangement (zie FullscreenDiagramEditor). Alleen
   * relevant in mode="edit"; in mode="view" wordt enkel diagramImageUrl
   * getoond. */
  diagramData?: DiagramData | null;
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
  /** Welke verplichte velden (zie REQUIRED_LESSON_FIELDS) op dit moment nog
   * leeg zijn — live bijgewerkt terwijl de gebruiker typt. Drijft zowel de
   * voortgangsbalk als de klikbare "nog niet ingevuld"-lijst eronder.
   * Alleen relevant in mode="edit". */
  missingFields?: RequiredFieldKey[];
  /** Verandert (nieuwe requestId) elke keer dat een buiten dit component
   * geïnitieerde submit-poging mislukte validatie tegenkomt — springt dan
   * naar het genoemde veld (tab wisselen indien nodig + scrollen + focus),
   * ook als het dezelfde veldnaam is als de vorige mislukte poging. */
  jumpToFieldTrigger?: { field: RequiredFieldKey; requestId: number } | null;
}) {
  const isEdit = mode === "edit";
  // Bewegingsthema is een verfijning BINNEN de gekozen leerlijn (zie
  // lib/constants/learningLines.ts) — alleen tonen als een select wanneer er
  // voor deze leerlijn een gecorroboreerde thema-lijst bestaat; anders is er
  // geen apart, los invulbaar tekstveld meer (dat was precies het probleem
  // met het oude model) en valt de weergave terug op de leerlijn zelf.
  const themeOptions = BEWEGINGSTHEMAS[learningLine] ?? [];
  const doelgroepLabels = doelgroep.map((waarde) => DOELGROEP_LABELS[waarde]).filter(Boolean);
  const hasBeginsituatieSection = Boolean(movementProblem) || doelgroepLabels.length > 0;
  const normalizedLearningOutcomes = splitLearningOutcomeItems(learningOutcomes);
  const showThemeField = isEdit ? themeOptions.length > 0 : Boolean(movementTheme);

  // Gecontroleerd i.p.v. Tabs' eigen `defaultValue`-state, zodat jumpToField
  // hieronder een tab kan omschakelen wanneer het gevraagde veld daarin
  // staat — nodig voor zowel de klikbare missing-fields-lijst als een
  // mislukte submit-poging elders (lesson-form.tsx's onInvalid).
  const [activeTab, setActiveTab] = useState<"lesinhoud" | "materiaal" | "leerhulp">(defaultTab);
  // Volledig-scherm canvas-editor (zie FullscreenDiagramEditor) — vervangt
  // de vroegere altijd-ingebedde DiagramEditorCard; de kaart hieronder toont
  // nu enkel nog een compacte preview + knop die dit opent.
  const [diagramModalOpen, setDiagramModalOpen] = useState(false);

  // Puur DOM-werk, geen setState — mag dus gewoon in een effect (zie
  // hieronder) zonder de react-hooks/set-state-in-effect-regel te raken.
  function scrollAndFocusField(field: RequiredFieldKey) {
    const el = document.getElementById(`field-${field}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusTarget =
      el instanceof HTMLInputElement || el instanceof HTMLSelectElement
        ? el
        : el.querySelector<HTMLElement>("input, select, textarea, button");
    focusTarget?.focus({ preventScroll: true });
  }

  // Voor de klikbare missing-fields-lijst hieronder: een echte user-event-
  // handler (button onClick), dus setActiveTab hier is prima — dit draait
  // nooit binnen een effect-body.
  function jumpToField(field: RequiredFieldKey) {
    const meta = REQUIRED_FIELD_BY_KEY.get(field);
    if (meta?.section) {
      setActiveTab(meta.section);
    }
    // Eén frame wachten: bij een tab-wissel moet de nieuwe TabsContent eerst
    // daadwerkelijk gemount zijn voordat het veld met dit id bestaat.
    requestAnimationFrame(() => scrollAndFocusField(field));
  }

  // Reageert op een submit-poging die buiten dit component vandaan komt
  // (lesson-form.tsx's onInvalid) — requestId zorgt dat dezelfde veldnaam
  // twee keer achter elkaar ook een nieuwe sprong triggert. De tab-wissel
  // gebeurt tijdens het renderen zelf (React's aanbevolen "state opslaan van
  // vorige render"-patroon, met useState i.p.v. useRef — refs mogen niet
  // gelezen/geschreven worden tijdens render) i.p.v. in een effect, want een
  // effect mag geen setState synchroon aanroepen
  // (react-hooks/set-state-in-effect) — alleen het echte DOM-werk
  // (scrollen/focussen) staat hieronder in een effect, want dat heeft geen
  // setState nodig.
  const [handledJumpRequestId, setHandledJumpRequestId] = useState(0);
  if (jumpToFieldTrigger && jumpToFieldTrigger.requestId !== handledJumpRequestId) {
    setHandledJumpRequestId(jumpToFieldTrigger.requestId);
    const meta = REQUIRED_FIELD_BY_KEY.get(jumpToFieldTrigger.field);
    if (meta?.section && meta.section !== activeTab) {
      setActiveTab(meta.section);
    }
  }

  useEffect(() => {
    if (!jumpToFieldTrigger) return;
    const raf = requestAnimationFrame(() => scrollAndFocusField(jumpToFieldTrigger.field));
    return () => cancelAnimationFrame(raf);
  }, [jumpToFieldTrigger]);

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

      {/* Header — eyebrow (alleen-lezen preview van leerlijn/thema) + titel
          als een echt herkenbaar tekstveld (rand + achtergrond, i.p.v.
          vrij-zwevende grote tekst). De leerlijn/thema zelf bewerk je
          hieronder in "Basisgegevens" — niet meer via een piepklein label
          hier, dat als dropdown nauwelijks te herkennen was. */}
      <div className="animate-fade-up space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={cn("font-mono text-xs font-semibold tracking-[0.14em] uppercase", WIZARD_CATEGORY_COLOR.text)}>
              {movementTheme || learningLine || "Activiteit"}
            </p>

            {isEdit ? (
              <>
                <input
                  id="field-title"
                  value={title}
                  onChange={(event) => onTitleChange?.(event.target.value)}
                  onBlur={() => onCommit?.()}
                  placeholder="Titel van de activiteit"
                  className={cn(
                    "mt-1.5 w-full rounded-lg border border-input bg-card px-3 py-2 text-2xl font-bold tracking-tight break-words shadow-xs outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-3xl dark:bg-input/30",
                    titleFlagged && IMPORT_FLAG_CLASS,
                  )}
                />
                <RequiredFieldHint show={titleFlagged} />
              </>
            ) : (
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight break-words sm:text-3xl">{title}</h1>
            )}
          </div>
          {!isEdit && (
            <SourceBadge source={activity?.author_id ? (isPublic ? "public" : "gymwiki") : "gymwiki"} className="mt-1 shrink-0" />
          )}
        </div>

        {/* Voortgang — direct onder de titel, altijd op dezelfde plek,
            dikkere/duidelijker gekleurde balk i.p.v. de vorige 1,5px-lijn.
            Gebaseerd op REQUIRED_LESSON_FIELDS (dezelfde 10 velden die
            "Activiteit opslaan" ook daadwerkelijk blokkeren) i.p.v. de
            eerdere losse "7 secties"-heuristiek, die ook optionele
            secties meetelde — dit telt nu precies wat er nog moet
            gebeuren om te kunnen opslaan. */}
        {isEdit && missingFields && (
          <div className="rounded-lg border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
              <span>
                {REQUIRED_LESSON_FIELDS.length - missingFields.length} van {REQUIRED_LESSON_FIELDS.length}{" "}
                verplichte velden ingevuld
              </span>
              {saveStatus && saveStatus !== "idle" && (
                <span aria-live="polite">{SAVE_STATUS_LABELS[saveStatus]}</span>
              )}
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300 ease-brand"
                style={{
                  width: `${((REQUIRED_LESSON_FIELDS.length - missingFields.length) / REQUIRED_LESSON_FIELDS.length) * 100}%`,
                }}
              />
            </div>
            {missingFields.length > 0 && (
              <div className="mt-2.5">
                <p className="text-xs text-muted-foreground">Nog niet ingevuld:</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {missingFields.map((field) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() => jumpToField(field)}
                      className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/20"
                    >
                      {REQUIRED_FIELD_BY_KEY.get(field)?.label ?? field}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Basisgegevens — leerlijn/thema + datum; voor welke groepen de
          activiteit bedoeld is, staat verderop bij de doelgroep-chips
          hieronder (geen los vrij-tekst "Groep/klas"-veld meer — dat was een
          dubbeling van diezelfde doelgroep-keuze). */}
      <Card className="animate-fade-up" style={{ animationDelay: "20ms" }}>
        <CardHeader>
          <CardTitle className="text-base">Basisgegevens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldLabel label="Leerlijn">
              {isEdit ? (
                <>
                  <select
                    id="field-learningLine"
                    value={learningLine}
                    onChange={(event) => {
                      onLearningLineChange?.(event.target.value);
                      onCommit?.();
                    }}
                    className={cn(SELECT_FIELD_CLASS, learningLineFlagged && IMPORT_FLAG_CLASS)}
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
                  <RequiredFieldHint show={learningLineFlagged} />
                </>
              ) : (
                <p className="text-sm">{learningLine || "-"}</p>
              )}
            </FieldLabel>

            {showThemeField && (
              <FieldLabel label="Bewegingsthema">
                {isEdit ? (
                  <select
                    value={themeOptions.includes(movementTheme) ? movementTheme : ""}
                    onChange={(event) => {
                      onMovementThemeChange?.(event.target.value);
                      onCommit?.();
                    }}
                    className={cn(SELECT_FIELD_CLASS, movementThemeFlagged && IMPORT_FLAG_CLASS)}
                  >
                    <option value="" disabled>
                      Kies een bewegingsthema
                    </option>
                    {themeOptions.map((theme) => (
                      <option key={theme} value={theme}>
                        {theme}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm">{movementTheme}</p>
                )}
              </FieldLabel>
            )}
          </div>

          {(isEdit || activityDate) && (
            <FieldLabel label="Datum">
              {isEdit ? (
                <>
                  <Input
                    id="field-lessonDate"
                    type="date"
                    value={activityDate}
                    onChange={(event) => onActivityDateChange?.(event.target.value)}
                    onBlur={() => onCommit?.()}
                    className={cn(activityDateFlagged && IMPORT_FLAG_CLASS)}
                  />
                  <RequiredFieldHint show={activityDateFlagged} />
                </>
              ) : (
                <p className="text-sm">{formatDate(activityDate) ?? "-"}</p>
              )}
            </FieldLabel>
          )}

          {(isEdit || doelgroepLabels.length > 0) && (
            <FieldLabel
              label="Doelgroep"
              hint="Voor welke groepen is deze activiteit geschikt? Bepaalt de filters in de bibliotheek."
            >
              <div className="flex flex-wrap gap-1.5">
                {isEdit
                  ? DOELGROEP_WAARDEN.map((waarde) => {
                      const active = doelgroep.includes(waarde);
                      return (
                        <button
                          key={waarde}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            onToggleDoelgroep?.(waarde);
                            onCommit?.();
                          }}
                          className={cn(
                            DOELGROEP_CHIP_CLASS,
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background text-muted-foreground hover:bg-accent",
                          )}
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
            </FieldLabel>
          )}

          {isEdit && (
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <Label htmlFor="publish-toggle">Delen in de gedeelde bibliotheek</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Alleen gedeelde, goedgekeurde activiteiten tellen mee voor je maandelijkse
                  bijdrage. Staat dit uit, dan is de activiteit alleen voor jezelf zichtbaar en
                  slaat de kwaliteitscheck over.
                </p>
              </div>
              <Switch
                id="publish-toggle"
                checked={publishToggle ?? true}
                onCheckedChange={(value) => onPublishToggleChange?.(value)}
              />
            </div>
          )}

          {(isEdit || authorName) && (
            <FieldLabel label="Docent">
              <p className="text-sm">{authorName ?? "-"}</p>
            </FieldLabel>
          )}
        </CardContent>
      </Card>

      {/* Groepsgrootte — twee losse getalvelden zonder uitleg was niet
          duidelijk of dit aantal leerlingen, materialen of iets anders
          betrof; nu met expliciete helptekst per veld. */}
      {(isEdit || minParticipants !== null || participantsBench !== null) && (
        <Card className="animate-fade-up" style={{ animationDelay: "30ms" }}>
          <CardHeader>
            <CardTitle className="text-base">Groepsgrootte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <FieldLabel label="In het veld" hint="Aantal leerlingen dat actief meedoet.">
                {isEdit ? (
                  <Input
                    type="number"
                    min={0}
                    value={minParticipants ?? ""}
                    onChange={(event) =>
                      onMinParticipantsChange?.(event.target.value === "" ? undefined : Number(event.target.value))
                    }
                    onBlur={() => onCommit?.()}
                  />
                ) : (
                  <p className="text-sm">{minParticipants ?? "-"}</p>
                )}
              </FieldLabel>
              <FieldLabel label="Op de bank" hint="Aantal leerlingen dat wacht of observeert.">
                {isEdit ? (
                  <Input
                    type="number"
                    min={0}
                    value={participantsBench ?? ""}
                    onChange={(event) =>
                      onParticipantsBenchChange?.(event.target.value === "" ? undefined : Number(event.target.value))
                    }
                    onBlur={() => onCommit?.()}
                  />
                ) : (
                  <p className="text-sm">{participantsBench ?? "-"}</p>
                )}
              </FieldLabel>
            </div>
          </CardContent>
        </Card>
      )}

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
            <>
              {diagramImageUrl ? (
                <button
                  type="button"
                  onClick={() => setDiagramModalOpen(true)}
                  className="group relative block h-48 w-full overflow-hidden rounded-2xl border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- external, unregistered hosts (Firebase/Supabase Storage) */}
                  <img
                    src={diagramImageUrl}
                    alt="Plattegrond van het arrangement"
                    className="size-full object-contain transition-transform duration-200 ease-brand group-hover:scale-[1.01]"
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDiagramModalOpen(true)}
                  className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-muted-foreground transition-colors duration-150 ease-brand hover:border-primary/50 hover:text-foreground"
                >
                  <ImageOff className="size-6" aria-hidden="true" />
                  <p className="text-sm">Nog geen plattegrond — maak er één</p>
                </button>
              )}
              <Button type="button" className="mt-3 w-full sm:w-auto" onClick={() => setDiagramModalOpen(true)}>
                <MapPinned className="size-4" />
                Plattegrond bewerken
              </Button>
              <FullscreenDiagramEditor
                open={diagramModalOpen}
                onOpenChange={setDiagramModalOpen}
                initialData={diagramData ?? null}
                onSave={(data, imageDataUrl) => onDiagramExport?.(data, imageDataUrl)}
              />
            </>
          ) : (
            <ActivityImageLightbox
              src={diagramImageUrl}
              alt="Plattegrond van het arrangement"
              emptyLabel="Geen tekening toegevoegd."
            />
          )}
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "lesinhoud" | "materiaal" | "leerhulp")}
        className="animate-fade-up"
        style={{ animationDelay: "80ms" }}
      >
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
                <div id="field-goals">
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
                <div id="field-movementProblem">
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
                <div id="field-deelnemersRegels">
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
                <div id="field-plaatjePraatje">
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
                <div id="field-aandachtspunten" className="sm:col-span-2">
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
              <div id="field-arrangement">
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
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 border-t bg-card p-2.5 shadow-brand-lg md:bottom-0 md:pb-[calc(0.625rem+env(safe-area-inset-bottom))] print:hidden">
        {isEdit ? (
          <>
            <AiLescoachButton payload={analyzePayload} className="flex-1" />
            <Button type="submit" disabled={isSubmitting} className="flex-[1.4] gap-2">
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? "Bezig met opslaan..." : "Activiteit opslaan"}
            </Button>
          </>
        ) : (
          <>
            {isOwnActivity && activity && (
              <Button asChild variant="outline" size="icon" className="shrink-0">
                <Link href={`/les-maken?vanuit=${activity.id}`} aria-label="Activiteit bewerken">
                  <Pencil className="size-4" />
                </Link>
              </Button>
            )}
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
