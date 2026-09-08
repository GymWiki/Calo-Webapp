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

export type DiagramElement = SystemDiagramElement | MaterialDiagramElement;

export function isMaterialElement(
  element: DiagramElement,
): element is MaterialDiagramElement {
  return element.kind === "material";
}

export type DiagramData = {
  width: number;
  height: number;
  /** Absent on older saved diagrams — treat as "top". */
  viewMode?: ViewMode;
  elements: DiagramElement[];
};
