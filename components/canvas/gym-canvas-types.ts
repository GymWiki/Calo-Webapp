// Vaste tekenprimitieven: spelers, scheidsrechter, teamclusters, lijnen en
// pijlen. Dit zijn géén "materiaal" (geen fysiek object dat je fotografeert)
// en blijven daarom hand-getekende vector-iconen met een vast, hardgecodeerd
// elementtype — in tegenstelling tot echt materiaal (ballen, kasten,
// pionnen, ...), dat sinds de materialenbibliotheek-uitbreiding dynamisch
// uit Supabase komt (zie types/material.ts en MaterialDiagramElement
// hieronder).
export type ElementCategory = "spelers_veld" | "lijnen_pijlen";

export const ELEMENT_CATEGORIES: ElementCategory[] = ["spelers_veld", "lijnen_pijlen"];

export const CATEGORY_LABELS: Record<ElementCategory, string> = {
  spelers_veld: "Spelers & veld",
  lijnen_pijlen: "Lijnen & pijlen",
};

export type ElementType =
  // Spelers & veld
  | "speler_rood"
  | "speler_blauw"
  | "scheidsrechter"
  | "team_a"
  | "team_b"
  // Lijnen & pijlen
  | "looplijn"
  | "looprichting_pijl"
  | "balbaan_pijl"
  | "aanvalszone";

export type ElementDef = {
  label: string;
  category: ElementCategory;
  width: number;
  height: number;
};

export const ELEMENT_DEFS: Record<ElementType, ElementDef> = {
  speler_rood: { label: "Speler rood", category: "spelers_veld", width: 28, height: 28 },
  speler_blauw: { label: "Speler blauw", category: "spelers_veld", width: 28, height: 28 },
  scheidsrechter: { label: "Scheidsrechter / Docent", category: "spelers_veld", width: 28, height: 28 },
  team_a: { label: "Team A (groepje)", category: "spelers_veld", width: 46, height: 40 },
  team_b: { label: "Team B (groepje)", category: "spelers_veld", width: 46, height: 40 },

  looplijn: { label: "Looplijn (gestippeld)", category: "lijnen_pijlen", width: 90, height: 4 },
  looprichting_pijl: { label: "Looprichting pijl", category: "lijnen_pijlen", width: 90, height: 4 },
  balbaan_pijl: { label: "Balbaan pijl (gecurveerd)", category: "lijnen_pijlen", width: 90, height: 40 },
  aanvalszone: { label: "Aanvalszone", category: "lijnen_pijlen", width: 100, height: 70 },
};

// Deze drie systeemtypes worden vervangen door de echte vector-lijnobjecten
// (LineDiagramElement hieronder) — niet meer aangeboden in de picker (zie
// GymCanvas.tsx), maar bewust NIET uit ELEMENT_DEFS/ElementType verwijderd:
// al bestaande opgeslagen tekeningen met deze elementen moeten correct
// blijven renderen.
export const LEGACY_LINE_TYPES: ElementType[] = [
  "looplijn",
  "looprichting_pijl",
  "balbaan_pijl",
];

export type ViewMode = "top" | "side";

type BaseElement = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
};

/**
 * Position/transform fields shared by every element kind — the only fields
 * drag/transform handlers ever update. Typed separately from
 * `Partial<DiagramElement>` because spreading a partial discriminated
 * union back onto a specific member confuses TypeScript's narrowing.
 */
export type ElementTransform = Pick<
  BaseElement,
  "x" | "y" | "rotation" | "scaleX" | "scaleY"
>;

/** Absent `kind` on older saved diagrams — treat as "system". */
export type SystemDiagramElement = BaseElement & {
  kind?: "system";
  type: ElementType;
};

/**
 * Materiaal uit de dynamische Supabase-bibliotheek. Naam/afbeelding/
 * afmetingen worden bij het toevoegen aan het canvas gekopieerd naar het
 * element zelf (niet live opgezocht via materialId), zodat een opgeslagen
 * tekening onafhankelijk blijft van latere wijzigingen of verwijderingen in
 * de materialenbibliotheek.
 */
export type MaterialDiagramElement = BaseElement & {
  kind: "material";
  materialId: string;
  name: string;
  imageUrl: string | null;
  width: number;
  height: number;
};

/**
 * Lijnen & pijlen — bewust GEEN BaseElement (geen x/y/rotation/scaleX/
 * scaleY): dat systeem is precies wat de oude, afbeelding-achtige
 * looplijn/looprichting_pijl/balbaan_pijl-iconen (zie ELEMENT_DEFS) liet
 * vervormen bij het verlengen/verkorten — een Transformer-schaal rekt de
 * pijlpunt en lijndikte gewoon evenredig mee uit. Een lijn wordt in plaats
 * daarvan gedefinieerd door zijn twee absolute eindpunten (in
 * canvas-coördinaten, dezelfde ruimte als BASE_WIDTH/BASE_HEIGHT); de lengte
 * verandert alleen door een eindpunt te verslepen, nooit door schaling —
 * strokeWidth en de pijlpunt (pointerLength/pointerWidth, zie GymCanvas.tsx)
 * blijven daardoor altijd constant, ongeacht de lijnlengte.
 */
export type LineVariant = "line" | "arrow" | "double_arrow";

export const LINE_VARIANT_LABELS: Record<LineVariant, string> = {
  line: "Rechte lijn",
  arrow: "Pijl",
  double_arrow: "Dubbele pijl",
};

export type LineDiagramElement = {
  id: string;
  kind: "line";
  variant: LineVariant;
  points: [number, number, number, number];
  stroke: string;
  strokeWidth: number;
};

/**
 * Tekstvak. `x`/`y` zijn bewust de linkerbovenhoek (in tegenstelling tot de
 * midden-verankering van andere elementen) — dat is het natuurlijke anker
 * voor tekst en scheelt offset-berekeningen bij het positioneren van de
 * HTML-`<textarea>`-overlay die het bewerken mogelijk maakt (zie
 * GymCanvas.tsx). Schalen via de gedeelde Transformer wordt direct omgezet
 * naar een nieuwe `fontSize` (scaleX/scaleY blijven op 1) zodat de tekst
 * scherp blijft i.p.v. uitgerekt.
 */
export type TextFontStyle = "normal" | "bold" | "italic" | "bold italic";

export type TextDiagramElement = BaseElement & {
  kind: "text";
  text: string;
  fontSize: number;
  fill: string;
  fontStyle: TextFontStyle;
};

/**
 * Veldpresets — kant-en-klare, correct geschaalde sportveldbelijning
 * (Volleybal, Basketbal, Badminton, Handbal, Zaalvoetbal). Net als
 * MaterialDiagramElement een BaseElement (x/y/rotation/scaleX/scaleY), zodat
 * een geplaatst preset via dezelfde generieke Group+Transformer-flow
 * verplaatst/geschaald/geroteerd kan worden als elk ander element — de
 * belijning zelf komt uit FIELD_PRESETS (field-presets.ts) en wordt hier
 * alleen met zijn sport-sleutel gerefereerd, niet gekopieerd.
 */
export type FieldPresetSport =
  | "volleybal"
  | "basketbal"
  | "badminton"
  | "handbal"
  | "zaalvoetbal";

export type FieldPresetDiagramElement = BaseElement & {
  kind: "field_preset";
  sport: FieldPresetSport;
};

export type DiagramElement =
  | SystemDiagramElement
  | MaterialDiagramElement
  | LineDiagramElement
  | TextDiagramElement
  | FieldPresetDiagramElement;

export function isMaterialElement(
  element: DiagramElement,
): element is MaterialDiagramElement {
  return element.kind === "material";
}

export function isLineElement(element: DiagramElement): element is LineDiagramElement {
  return element.kind === "line";
}

export function isTextElement(element: DiagramElement): element is TextDiagramElement {
  return element.kind === "text";
}

export function isFieldPresetElement(
  element: DiagramElement,
): element is FieldPresetDiagramElement {
  return element.kind === "field_preset";
}

/** Ondergrond van het canvas — stuurt alleen de achtergrond, nooit de geplaatste elementen. */
export type LocationType = "indoor" | "outdoor";

export type DiagramData = {
  width: number;
  height: number;
  /** Absent on older saved diagrams — treat as "top". */
  viewMode?: ViewMode;
  /** Absent op oudere tekeningen — behandel als "indoor" (bestaande zaalvloer). */
  locationType?: LocationType;
  elements: DiagramElement[];
};
