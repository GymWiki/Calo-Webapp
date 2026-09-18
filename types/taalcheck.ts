// Mirrors supabase/migrations/activiteiten_taalcheck.sql.

export const TAALCHECK_VOORSTEL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "applied",
] as const;
export type TaalcheckVoorstelStatus = (typeof TAALCHECK_VOORSTEL_STATUSES)[number];

export type TaalcheckVoorstel = {
  id: string;
  activiteit_id: string;
  veldnaam: string;
  originele_tekst: string;
  voorgestelde_tekst: string;
  reden_van_wijziging: string;
  status: TaalcheckVoorstelStatus;
  gegenereerd_op: string;
  beoordeeld_op: string | null;
  beoordeeld_door: string | null;
  toegepast_op: string | null;
};

// Voor de review-pagina: een voorstel + de titel van de bijbehorende
// activiteit (voor de "Activiteit (titel + link)"-kolom uit de brief) —
// een losse join i.p.v. de titel in elke voorstel-rij te dupliceren.
export type TaalcheckVoorstelWithActivity = TaalcheckVoorstel & {
  activiteit_titel: string;
};
