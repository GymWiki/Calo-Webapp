// Veldpresets — kant-en-klare sportveldbelijning die als één FieldPresetDiagramElement
// op het canvas geplaatst wordt (zie gym-canvas-types.ts). Alle geometrie hieronder is
// gecentreerd op lokale coördinaat (0,0) en uitgedrukt in dezelfde canvas-eenheden als
// de rest van de tekening (BASE_WIDTH/BASE_HEIGHT in GymCanvas.tsx), zodat een preset
// zonder verdere omrekening als kind van de bestaande, geschaalde/geroteerde Group kan
// renderen — precies hetzelfde generieke pad als materiaal/systeem-elementen.
//
// Schaal: er bestond nergens in de codebase een vastgelegde meters-naar-canvas-eenheden
// verhouding. De decoratieve zaalvloer-achtergrond (GymBackground in GymCanvas.tsx)
// tekent een "speelvlak"-rechthoek van 740x500 eenheden met een rasterstap van 40
// eenheden — dat raster is hier bewust als 1 rastervak = 1 meter geïnterpreteerd, dus
// CANVAS_UNITS_PER_METER = 40. Een dubbele gymzaal (~18,5 x 12,5 m) komt daarmee vrijwel
// exact overeen met dat speelvlak.
import type { FieldPresetSport } from "./gym-canvas-types";

export const CANVAS_UNITS_PER_METER = 40;

// Grotere presets (basketbal/handbal/zaalvoetbal zijn in werkelijkheid groter dan een
// standaard schoolgymzaal) krijgen bij plaatsing een initiële schaal zodat ze meteen
// volledig zichtbaar zijn — de onderlinge verhoudingen binnen het preset blijven exact
// (het is een uniforme scaleX/scaleY, geen vervorming), en de gebruiker kan daarna zelf
// verder vergroten/verkleinen via de bestaande Transformer.
const TARGET_MAX_SPAN = 700;

function m(meters: number) {
  return meters * CANVAS_UNITS_PER_METER;
}

export type FieldLine = {
  points: number[];
  dash?: number[];
};

export type FieldCircle = {
  x: number;
  y: number;
  radius: number;
};

export type FieldPresetGeometry = {
  label: string;
  widthM: number;
  heightM: number;
  /** widthM/heightM * CANVAS_UNITS_PER_METER — de as-gelijnde omvang, gecentreerd op (0,0). */
  width: number;
  height: number;
  lines: FieldLine[];
  circles: FieldCircle[];
  initialScale: number;
};

export const FIELD_PRESET_SPORTS: FieldPresetSport[] = [
  "volleybal",
  "basketbal",
  "badminton",
  "handbal",
  "zaalvoetbal",
];

export const FIELD_PRESET_LABELS: Record<FieldPresetSport, string> = {
  volleybal: "Volleybal",
  basketbal: "Basketbal",
  badminton: "Badminton",
  handbal: "Handbal",
  zaalvoetbal: "Zaalvoetbal / Korfbal",
};

/** Boogpunten (math-hoekconventie, graden) — gebruikt voor cirkelsegmenten die niet als volle Konva Circle getekend worden (bv. driepuntslijn, vrijeworpgebied). */
function arcPoints(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number,
  segments = 24,
): number[] {
  const pts: number[] = [];
  const start = (startDeg * Math.PI) / 180;
  const end = (endDeg * Math.PI) / 180;
  for (let i = 0; i <= segments; i++) {
    const t = start + ((end - start) * i) / segments;
    pts.push(cx + radius * Math.cos(t), cy + radius * Math.sin(t));
  }
  return pts;
}

function rectOutline(width: number, height: number): FieldLine {
  const hw = width / 2;
  const hh = height / 2;
  return { points: [-hw, -hh, hw, -hh, hw, hh, -hw, hh, -hw, -hh] };
}

function build(
  sport: FieldPresetSport,
  widthM: number,
  heightM: number,
  lines: FieldLine[],
  circles: FieldCircle[] = [],
): FieldPresetGeometry {
  const width = m(widthM);
  const height = m(heightM);
  return {
    label: FIELD_PRESET_LABELS[sport],
    widthM,
    heightM,
    width,
    height,
    lines,
    circles,
    initialScale: Math.min(1, TARGET_MAX_SPAN / Math.max(width, height)),
  };
}

// Volleybal — 18 x 9 m (officiële FIVB-afmetingen). Net op de middellijn,
// aanvalslijnen 3 m aan weerszijden van het net.
function buildVolleybal(): FieldPresetGeometry {
  const widthM = 18;
  const heightM = 9;
  const hh = m(heightM) / 2;
  const attackOffset = m(3);
  return build("volleybal", widthM, heightM, [
    rectOutline(m(widthM), m(heightM)),
    { points: [0, -hh, 0, hh] }, // net / middellijn
    { points: [-attackOffset, -hh, -attackOffset, hh] },
    { points: [attackOffset, -hh, attackOffset, hh] },
  ]);
}

// Basketbal — FIBA-veld 28 x 15 m. Vrijeworp-cirkel r=1,8 m, vrijeworpzone
// 5,8 (diep) x 4,9 m (breed), driepuntslijn r=6,75 m — vereenvoudigd als halve
// cirkel (FIBA's exacte lijn heeft rechte stukken bij de zijlijn vóór de boog
// begint; die nuance is hier bewust weggelaten voor een duidelijke, robuuste
// vorm). Basket op 1,575 m van de achterlijn.
function buildBasketbal(): FieldPresetGeometry {
  const widthM = 28;
  const heightM = 15;
  const hw = m(widthM) / 2;
  const laneDepth = m(5.8);
  const laneHalfWidth = m(4.9) / 2;
  const freeThrowRadius = m(1.8);
  const threePointRadius = m(6.75);
  const basketInset = m(1.575);
  const hoopRadius = m(0.23);

  const lines: FieldLine[] = [rectOutline(m(widthM), m(heightM)), { points: [0, -m(heightM) / 2, 0, m(heightM) / 2] }];
  const circles: FieldCircle[] = [{ x: 0, y: 0, radius: freeThrowRadius }];

  for (const side of [-1, 1] as const) {
    const baseline = side * hw;
    const laneEnd = baseline - side * laneDepth;
    const basket = baseline - side * basketInset;

    lines.push({
      points: [baseline, -laneHalfWidth, laneEnd, -laneHalfWidth, laneEnd, laneHalfWidth, baseline, laneHalfWidth],
    });
    circles.push({ x: laneEnd, y: 0, radius: freeThrowRadius });
    circles.push({ x: basket, y: 0, radius: hoopRadius });
    lines.push({
      points: arcPoints(basket, 0, threePointRadius, side === -1 ? -90 : 90, side === -1 ? 90 : 270),
    });
  }

  return build("basketbal", widthM, heightM, lines, circles);
}

// Badminton — dubbelveld 13,4 x 6,1 m (BWF). Enkelspel-zijlijn 0,46 m
// ingesprongen, korte-servicelijn 1,98 m vanaf het net, lange-servicelijn
// (dubbel) 0,76 m vanaf de achterlijn, middenlijn deelt elk servicevak.
function buildBadminton(): FieldPresetGeometry {
  const widthM = 13.4;
  const heightM = 6.1;
  const hw = m(widthM) / 2;
  const hh = m(heightM) / 2;
  const singlesHalfWidth = hh - m(0.46);
  const shortServiceX = m(1.98);
  const longServiceX = hw - m(0.76);

  return build("badminton", widthM, heightM, [
    rectOutline(m(widthM), m(heightM)),
    { points: [-hw, -singlesHalfWidth, hw, -singlesHalfWidth] },
    { points: [-hw, singlesHalfWidth, hw, singlesHalfWidth] },
    { points: [0, -hh, 0, hh] }, // net
    { points: [-shortServiceX, -hh, -shortServiceX, hh] },
    { points: [shortServiceX, -hh, shortServiceX, hh] },
    { points: [-longServiceX, -hh, -longServiceX, hh] },
    { points: [longServiceX, -hh, longServiceX, hh] },
    { points: [shortServiceX, 0, hw, 0] },
    { points: [-shortServiceX, 0, -hw, 0] },
  ]);
}

// Handbal — 40 x 20 m (IHF). Doelgebied (D-vorm, r=6 m om elke doelpaal +
// rechte verbinding), vrijeworplijn vereenvoudigd als enkele boog r=9 m vanaf
// het midden van de doellijn (i.p.v. de officiële, per doelpaal-gecentreerde
// samengestelde vorm — die zou bij dit veldformaat net buiten de zijlijn
// uitkomen; deze vereenvoudiging blijft duidelijk herkenbaar en altijd
// binnen het veld).
function buildGoalArea(goalLineX: number, direction: 1 | -1, radius: number): FieldLine {
  const postOffset = m(1.5);
  return {
    points: [
      ...arcPoints(goalLineX, -postOffset, radius, direction === 1 ? 90 : -90, direction === 1 ? 180 : -180),
      ...arcPoints(goalLineX, postOffset, radius, direction === 1 ? 180 : 0, direction === 1 ? 270 : -90),
    ],
  };
}

function buildHandbal(): FieldPresetGeometry {
  const widthM = 40;
  const heightM = 20;
  const hw = m(widthM) / 2;
  const hh = m(heightM) / 2;
  const goalAreaRadius = m(6);
  const freeThrowRadius = m(9);
  const goalHalfWidth = m(1.5);
  const goalDepth = m(1);

  const lines: FieldLine[] = [
    rectOutline(m(widthM), m(heightM)),
    { points: [0, -hh, 0, hh] },
  ];

  for (const side of [-1, 1] as const) {
    const goalLineX = side * hw;
    lines.push(buildGoalArea(goalLineX, side, goalAreaRadius));
    lines.push({
      points: arcPoints(goalLineX, 0, freeThrowRadius, side === -1 ? -90 : 90, side === -1 ? 90 : 270),
      dash: [10, 8],
    });
    lines.push(
      rectOutline(goalDepth, goalHalfWidth * 2),
    );
    // Doeltje tegen de doellijn aan (niet gecentreerd op (0,0) zoals rectOutline
    // teruggeeft) — laatst toegevoegde lijn hierboven verschuiven naar de doellijn.
    const goal = lines[lines.length - 1];
    goal.points = goal.points.map((v, i) => (i % 2 === 0 ? v + goalLineX - side * goalDepth / 2 : v));
  }

  return build("handbal", widthM, heightM, lines);
}

// Zaalvoetbal / Korfbal — hergebruikt het handbalveld (40 x 20 m) en de 6 m
// doelgebied-D-vorm, met een middencirkel (r=3 m) i.p.v. handbal's 9 m-lijn
// (zaalvoetbal kent geen vrijeworplijn). Deelbaar met korfbal, dat een
// vergelijkbaar zaalformaat gebruikt.
function buildZaalvoetbal(): FieldPresetGeometry {
  const widthM = 40;
  const heightM = 20;
  const hw = m(widthM) / 2;
  const hh = m(heightM) / 2;
  const goalAreaRadius = m(6);
  const centerCircleRadius = m(3);
  const goalHalfWidth = m(1.5);
  const goalDepth = m(0.8);

  const lines: FieldLine[] = [
    rectOutline(m(widthM), m(heightM)),
    { points: [0, -hh, 0, hh] },
  ];

  for (const side of [-1, 1] as const) {
    const goalLineX = side * hw;
    lines.push(buildGoalArea(goalLineX, side, goalAreaRadius));
    lines.push(rectOutline(goalDepth, goalHalfWidth * 2));
    const goal = lines[lines.length - 1];
    goal.points = goal.points.map((v, i) => (i % 2 === 0 ? v + goalLineX - side * goalDepth / 2 : v));
  }

  return build("zaalvoetbal", widthM, heightM, lines, [{ x: 0, y: 0, radius: centerCircleRadius }]);
}

export const FIELD_PRESETS: Record<FieldPresetSport, FieldPresetGeometry> = {
  volleybal: buildVolleybal(),
  basketbal: buildBasketbal(),
  badminton: buildBadminton(),
  handbal: buildHandbal(),
  zaalvoetbal: buildZaalvoetbal(),
};
