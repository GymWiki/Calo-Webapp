// Status van een activiteit voor het beheer. In de database zijn dit twee kolommen (status + visibility) plus deleted_at;
// beheerders zien en kiezen één van drie begrijpelijke standen. "Gearchiveerd" is geen aparte kolom: goedgekeurd maar niet openbaar.

export type ActivityStateInput = { status: string; visibility: string; deleted_at?: string | null };

export type ActivityState = "concept" | "gepubliceerd" | "gearchiveerd" | "in-beoordeling" | "afgewezen" | "verwijderd";
export type TargetState = "concept" | "gepubliceerd" | "gearchiveerd";

export const TARGET_STATES: { value: TargetState; label: string; hint: string }[] = [
  { value: "concept", label: "Concept", hint: "Niet openbaar, nog niet klaar" },
  { value: "gepubliceerd", label: "Gepubliceerd", hint: "Goedgekeurd en openbaar zichtbaar" },
  { value: "gearchiveerd", label: "Gearchiveerd", hint: "Bewaard, maar niet openbaar" },
];

export const STATE_LABEL: Record<ActivityState, string> = {
  concept: "Concept",
  gepubliceerd: "Gepubliceerd",
  gearchiveerd: "Gearchiveerd",
  "in-beoordeling": "In beoordeling",
  afgewezen: "Afgewezen",
  verwijderd: "Verwijderd",
};

export function deriveState(a: ActivityStateInput): ActivityState {
  if (a.deleted_at) return "verwijderd";
  if (a.status === "draft") return "concept";
  if (a.status === "pending") return "in-beoordeling";
  if (a.status === "rejected") return "afgewezen";
  return a.visibility === "public" ? "gepubliceerd" : "gearchiveerd";
}

export function stateToColumns(target: TargetState): { status: string; visibility: string } {
  if (target === "concept") return { status: "draft", visibility: "private" };
  if (target === "gepubliceerd") return { status: "approved", visibility: "public" };
  return { status: "approved", visibility: "private" };
}

/** Teamactiviteiten wisselen niet van zichtbaarheid via het beheer (bestaande guard in de database). */
export const canChangeState = (a: { visibility: string }): boolean => a.visibility !== "team";
