// Vloermarkeringen (sportlijnen) per sport en variant: officiële afmetingen, vrije ruimte, bron. Eén bron van waarheid voor wat in een zaal past.
// Uitbreiden: voeg een regel toe aan COURT_MARKINGS (geen codewijziging elders nodig). Waarden met `verified: false` zijn ONBEKEND/gekozen en
// moeten door een mens worden bevestigd; de bron staat in docs/lijnen-specificaties.md. Puur: geen React/three.

export type Orientation = "lengthwise" | "crosswise";

export type CourtMarking = {
  id: string;
  sport: string;
  label: string;
  /** Veldafmetingen in meter: lengte (langste zijde) × breedte. */
  length_m: number;
  width_m: number;
  /** Minimale vrije ruimte rondom die we eisen voor "past" (`side` = langs de lange zijden, `end` = achter de korte zijden). */
  runoff_min_m: { side: number; end: number };
  /** Officiële/aanbevolen vrije ruimte (alleen voor een hint als de minimale maat onder de officiële ligt). */
  runoff_official_m?: { side: number; end: number };
  /** Mogelijke oriëntaties in de zaal (lengthwise = veldlengte langs de lange zaalzijde). */
  orientations: Orientation[];
  /** Mogen velden van dezelfde sport naast elkaar met een gedeelde vrije ruimte? Waarde = ruimte tussen twee velden (m); weggelaten = twee keer de zijruimte. */
  shared_gap_m?: number;
  /** Lijnkleur (consistent per sport; legenda) en lijndikte (m). */
  color: string;
  line_width_m: number;
  /** Koppeling met de bestaande lijn-nodes in het zaalmodel (`GymLayout.lijnen[].id`), en hoeveel velden die node tekent. */
  glb_line_id?: string;
  glb_copies?: number;
  /** Bron en of de waarde in een officieel reglement is gevonden. */
  source: string;
  verified: boolean;
};

export const COURT_MARKINGS: readonly CourtMarking[] = [
  {
    id: "volleybal",
    sport: "volleybal",
    label: "Volleybal (18 × 9 m)",
    length_m: 18,
    width_m: 9,
    runoff_min_m: { side: 2, end: 2 },
    runoff_official_m: { side: 3, end: 3 },
    orientations: ["lengthwise", "crosswise"],
    color: "#2563eb",
    line_width_m: 0.05,
    glb_line_id: "lijnen-volleybal",
    glb_copies: 1,
    source: "Special Olympics NL volleybalreglement 2022 (volgt Nevobo): veld 18 × 9 m, vrije zone ≥ 3 m. Minimum 2 m = gekozen (ONBEKEND) voor gymzalen.",
    verified: false,
  },
  {
    id: "volleybal-dwars",
    sport: "volleybal",
    label: "Volleybal, 3 velden naast elkaar",
    length_m: 18,
    width_m: 9,
    runoff_min_m: { side: 2, end: 2 },
    runoff_official_m: { side: 3, end: 3 },
    orientations: ["lengthwise", "crosswise"],
    color: "#2563eb",
    line_width_m: 0.05,
    glb_line_id: "lijnen-volleybal-dwars",
    glb_copies: 3,
    source: "Drie officiële velden (18 × 9 m) naast elkaar; het bestaande model tekent drie verkleinde velden en klopt dus niet met de werkelijkheid.",
    verified: false,
  },
  {
    id: "badminton",
    sport: "badminton",
    label: "Badminton dubbel (13,40 × 6,10 m)",
    length_m: 13.4,
    width_m: 6.1,
    runoff_min_m: { side: 0.3, end: 0.3 },
    runoff_official_m: { side: 1.5, end: 2 },
    orientations: ["lengthwise", "crosswise"],
    shared_gap_m: 0.3,
    color: "#16a34a",
    line_width_m: 0.04,
    glb_line_id: "lijnen-badminton",
    glb_copies: 1,
    source: "Badminton Nederland, Uitvoeringsregeling Accommodatievoorschriften 2023-2024: dubbelspel 6,10 × 13,40 m. Minimale ruimte 0,3 m = gekozen (ONBEKEND); officieel advies 2 m achter/1,5 m opzij (indicatie, Sport Scotland).",
    verified: false,
  },
  {
    id: "badminton-dwars",
    sport: "badminton",
    label: "Badminton, 3 velden naast elkaar",
    length_m: 13.4,
    width_m: 6.1,
    runoff_min_m: { side: 0.3, end: 0.3 },
    runoff_official_m: { side: 1.5, end: 2 },
    orientations: ["lengthwise", "crosswise"],
    shared_gap_m: 0.3,
    color: "#16a34a",
    line_width_m: 0.04,
    glb_line_id: "lijnen-badminton-dwars",
    glb_copies: 3,
    source: "Drie dubbelvelden (13,40 × 6,10 m) naast elkaar met 0,3 m ertussen (ONBEKEND: geen reglementaire minimale tussenruimte gevonden).",
    verified: false,
  },
  {
    id: "basketbal",
    sport: "basketbal",
    label: "Basketbal verkleind (school, ca. 20,7 × 11 m)",
    length_m: 20.66,
    width_m: 11.05,
    runoff_min_m: { side: 0.5, end: 0.5 },
    orientations: ["lengthwise"],
    color: "#dc2626",
    line_width_m: 0.05,
    glb_line_id: "lijnen-basketbal",
    glb_copies: 1,
    source: "ONBEKEND: geen reglement voor een verkleind veld gevonden; maat is die van het bestaande model. Volledig veld: 28 × 15 m (NBB-minispelregels; praktijk vaak 26 × 14 m).",
    verified: false,
  },
  {
    id: "basketbal-volledig",
    sport: "basketbal",
    label: "Basketbal volledig (28 × 15 m)",
    length_m: 28,
    width_m: 15,
    runoff_min_m: { side: 0, end: 0 },
    runoff_official_m: { side: 2, end: 2 },
    orientations: ["lengthwise"],
    color: "#dc2626",
    line_width_m: 0.05,
    source: "NBB minispelregels / FIBA: 28 × 15 m (in de praktijk vaak 26 × 14 m). Nog geen lijnenmodel beschikbaar.",
    verified: true,
  },
  {
    id: "handbal",
    sport: "handbal",
    label: "Handbal verkleind (ca. 22 × 13 m)",
    length_m: 22.08,
    width_m: 13.18,
    runoff_min_m: { side: 0.25, end: 0.25 },
    orientations: ["lengthwise"],
    color: "#7c3aed",
    line_width_m: 0.05,
    glb_line_id: "lijnen-handbal",
    glb_copies: 1,
    source: "ONBEKEND: maat van het bestaande model. Volledig veld 40 × 20 m (NHV, schoolhandbaltoernooien).",
    verified: false,
  },
  {
    id: "handbal-volledig",
    sport: "handbal",
    label: "Handbal volledig (40 × 20 m)",
    length_m: 40,
    width_m: 20,
    runoff_min_m: { side: 0, end: 0 },
    orientations: ["lengthwise"],
    color: "#7c3aed",
    line_width_m: 0.05,
    source: "NHV, 4.2 Speelwijze schoolhandbaltoernooien: handbalveld 40 × 20 m. Uitloopruimte: ONBEKEND.",
    verified: true,
  },
  {
    id: "zaalvoetbal",
    sport: "zaalvoetbal",
    label: "Zaalvoetbal klein veld (ca. 22 × 13,4 m)",
    length_m: 22.08,
    width_m: 13.43,
    runoff_min_m: { side: 0.2, end: 0.2 },
    orientations: ["lengthwise"],
    color: "#f59e0b",
    line_width_m: 0.08,
    glb_line_id: "lijnen-zaalvoetbal",
    glb_copies: 1,
    source: "ONBEKEND: maat van het bestaande model. KNVB-norm zaalvoetbal: 38–42 × 18–25 m met ≥ 2 m obstakelvrije uitloop.",
    verified: false,
  },
  {
    id: "zaalvoetbal-volledig",
    sport: "zaalvoetbal",
    label: "Zaalvoetbal volledig (38–42 × 18–25 m)",
    length_m: 38,
    width_m: 18,
    runoff_min_m: { side: 2, end: 2 },
    orientations: ["lengthwise"],
    color: "#f59e0b",
    line_width_m: 0.08,
    source: "KNVB, kwaliteitsnormen zaalvoetbalaccommodaties: lengte 38–42 m, breedte 18–25 m, uitloopruimte ≥ 2 m. Kleinste maat gebruikt.",
    verified: true,
  },
  {
    id: "zaalkorfbal",
    sport: "korfbal",
    label: "Zaalkorfbal (ca. 22 × 13 m)",
    length_m: 22.05,
    width_m: 13.05,
    runoff_min_m: { side: 0.25, end: 0.25 },
    orientations: ["lengthwise"],
    color: "#0891b2",
    line_width_m: 0.05,
    glb_line_id: "lijnen-zaalkorfbal",
    glb_copies: 1,
    source: "ONBEKEND: maat van het bestaande model; KNKV-maten niet kunnen ophalen (Handboek Kwaliteitseisen Korfbalaccommodaties).",
    verified: false,
  },
  {
    id: "zaalhockey",
    sport: "zaalhockey",
    label: "Zaalhockey (ca. 22 × 13 m)",
    length_m: 22.05,
    width_m: 13.05,
    runoff_min_m: { side: 0.25, end: 0.25 },
    orientations: ["lengthwise"],
    color: "#db2777",
    line_width_m: 0.05,
    glb_line_id: "lijnen-zaalhockey",
    glb_copies: 1,
    source: "ONBEKEND: maat van het bestaande model; KNHB-maten niet gevonden.",
    verified: false,
  },
  {
    id: "tennis",
    sport: "tennis",
    label: "Tennis (ca. 22 × 10,2 m)",
    length_m: 22.05,
    width_m: 10.2,
    runoff_min_m: { side: 0.25, end: 0.25 },
    orientations: ["lengthwise"],
    color: "#65a30d",
    line_width_m: 0.05,
    glb_line_id: "lijnen-tennis",
    glb_copies: 1,
    source: "ONBEKEND: maat van het bestaande model (officieel 23,77 × 10,97 m dubbel; niet in het onderzoek opgenomen).",
    verified: false,
  },
];

export const COURT_MARKINGS_BY_ID: ReadonlyMap<string, CourtMarking> = new Map(COURT_MARKINGS.map((marking) => [marking.id, marking]));
