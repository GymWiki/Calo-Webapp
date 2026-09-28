export type TeamLibraryItemKind = "own" | "reference";

export type TeamTag = {
  id: string;
  teamId: string;
  name: string;
  color: string | null;
  createdBy: string | null;
  createdAt: string;
  /** Aantal items waaraan deze tag hangt — alleen gevuld op de tags-beheerpagina. */
  itemCount?: number;
};

/** Eén teambibliotheek-item + zijn tags — de eenheid die de bibliotheek-UI toont. */
export type TeamLibraryItem = {
  id: string;
  teamId: string;
  activityId: string;
  kind: TeamLibraryItemKind;
  addedBy: string | null;
  addedAt: string;
  tags: TeamTag[];
};

/** Eén versie uit activity_versions — voor de "Vorige versies"-lijst. */
export type ActivityVersionSummary = {
  id: string;
  version: number;
  changedBy: string | null;
  changedByName: string | null;
  changedAt: string;
};

/** Teruggegeven door updateTeamActivity bij een optimistic-locking-conflict. */
export type TeamActivityConflict = {
  conflict: true;
  latestVersion: number;
  changedByName: string | null;
};
