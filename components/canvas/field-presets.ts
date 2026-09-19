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
//
// AUDIT (tegen de actuele, officiële wedstrijdafmetingen van elke sportbond — zie de
// toelichting per build-functie hieronder voor de precieze bron/getallen): alle vijf
// bestaande presets bleken bij controle al correct. Geen van de vijf is dus in deze
// audit-ronde gewijzigd — alleen het badminton-label is verduidelijkt (zie
// FIELD_PRESET_LABELS) om expliciet te maken dat het de dubbelspel-belijning is
// (met de enkelspel-zijlijnen erbinnen getekend), niet een aparte enkelspel-variant.
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
  // Expliciet "dubbel" in het label: de belijning is het dubbelspelveld
  // (13,4 x 6,1 m, BWF) MET de enkelspel-zijlijnen erbinnen getekend (zie
  // buildBadminton) — zonder deze toevoeging leek "Badminton" een generiek,
  // ongespecificeerd veld te suggereren terwijl het er één specifieke
  // (weliswaar de meest gebruikte) variant is.
  badminton: "Badminton (dubbel, incl. enkellijnen)",
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

// Volleybal — 18 x 9 m (officiële FIVB-afmetingen, FIVB Official Volleyball
// Rules 2025-2028). Net op de middellijn, aanvalslijnen 3 m aan weerszijden
// van het net. AUDIT: klopt, geen wijziging nodig.
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
// vorm). Basket op 1,575 m van de achterlijn. AUDIT: alle getallen kloppen
// tegen de actuele FIBA-regels — geen wijziging nodig.
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
// ingesprongen (dus een enkelspelbreedte van 6,1 - 2x0,46 = 5,18 m — exact de
// officiële enkelspelmaat), korte-servicelijn 1,98 m vanaf het net,
// lange-servicelijn (dubbel) 0,76 m vanaf de achterlijn, middenlijn deelt elk
// servicevak. AUDIT: alle getallen kloppen tegen de actuele BWF-regels
// (inclusief de dubbel/enkelspel-verhouding uit de brief) — geen wijziging
// aan de geometrie nodig, alleen het label verduidelijkt (zie
// FIELD_PRESET_LABELS) zodat "welke variant" expliciet is.
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
// binnen het veld). AUDIT: veldmaat en de twee radii (6 m/9 m) kloppen tegen
// de actuele IHF-regels — geen wijziging nodig.
// BUGFIX (canvas-editor rapport): de oorspronkelijke boogparameters hierboven
// gaven bij `side=-1` een kwartcirkel die ~6 m VOORBIJ de achterlijn/buiten
// het veld uitstak, en de twee bogen sloten niet op elkaar aan — Konva
// tekende daardoor één doorlopende lijn met een lange, onbedoelde diagonale
// "sprong" tussen de losse boog-eindpunten. Dat verklaart het gerapporteerde
// beeld (niet-passende bogen, een "los" ogend doelgebied, en een
// Transformer-selectiekader dat groter is dan het veld — Konva's Transformer
// berekent zijn kader live uit de daadwerkelijk getekende, overlopende
// geometrie, los van de eigen getElementBounds()-berekening in
// GymCanvas.tsx). Nieuwe, geverifieerde constructie volgens de officiële
// IHF-regel: twee kwartcirkels van 6 m om elke doelpaal, elk begint op de
// doellijn aan de kant weg van de andere paal en zwaait 90° naar het punt op
// 6 m diepte t.h.v. diezelfde paal — de twee diepte-eindpunten liggen zo 3 m
// uit elkaar (gelijk aan de 2x1,5 m paalafstand) en worden door Konva als
// rechte lijn verbonden doordat ze gewoon opeenvolgende punten zijn in
// dezelfde `points`-array.
function buildGoalArea(goalLineX: number, side: 1 | -1, radius: number): FieldLine {
  const postOffset = m(1.5);
  const fieldAngle = side === 1 ? 180 : 0;
  const farFieldAngle = side === 1 ? -180 : 0;
  return {
    points: [
      ...arcPoints(goalLineX, postOffset, radius, 90, fieldAngle),
      ...arcPoints(goalLineX, -postOffset, radius, farFieldAngle, -90),
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
// vergelijkbaar zaalformaat gebruikt. AUDIT: 40x20 m, het doelgebied (FIFA
// futsal: kwartcirkels r=6 m vanaf de palen) en het doel van 3 m breed
// (goalHalfWidth=1,5 m) kloppen tegen de actuele FIFA Futsal Laws of the
// Game — geen wijziging nodig (FIFA's verbindingslijn tussen de twee
// kwartcirkels is exact 3,16 m i.p.v. de hier gebruikte generieke
// D-vorm-constructie; dat verschil van 16 cm is visueel niet waarneembaar op
// deze schaal en dus bewust niet apart aangepast).
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

// ============================================================================
// Ondergrond-belijning voor de "Zwembad"/"Atletiekbaan"-ondergrondopties (zie
// LocationType in gym-canvas-types.ts) — géén FieldPresetDiagramElement (die
// worden los, verplaatsbaar op het canvas GEPLAATST), maar een vaste
// ACHTERGROND-tekening die GymBackground (GymCanvas.tsx) rendert zolang die
// ondergrond actief is, net als de bestaande grasmat/vloer-decoratie voor
// buiten/binnen. Hergebruikt dezelfde m()/CANVAS_UNITS_PER_METER-conventie
// als de sportveld-presets hierboven zodat de banen ONDERLING correct
// geschaald zijn (breedte-op-lengte-verhouding klopt); een los `fitScale`
// (analoog aan initialScale hierboven) schaalt het geheel daarna uniform
// terug zodat het altijd binnen de vaste 800x560-canvas past — zonder dat
// zou een letterlijke 40-eenheden-per-meter-weergave van een 25m-bad of een
// 60m-baan het canvas ver overschrijden.
// ============================================================================

export type FacilityBackgroundGeometry = {
  widthM: number;
  heightM: number;
  width: number;
  height: number;
  lines: FieldLine[];
  fitScale: number;
};

// Zelfde "speelvlak"-oppervlak als de bestaande indoor/outdoor-decoratie
// (BASE_WIDTH-60 x BASE_HEIGHT-60, zie GymBackground) — zo blijft de
// zwembad/atletiekbaan-achtergrond even groot op het canvas als de
// bestaande gymzaalvloer/grasmat.
const BACKGROUND_FIT_WIDTH = 740;
const BACKGROUND_FIT_HEIGHT = 500;

function buildFacilityBackground(
  widthM: number,
  heightM: number,
  lines: FieldLine[],
): FacilityBackgroundGeometry {
  const width = m(widthM);
  const height = m(heightM);
  return {
    widthM,
    heightM,
    width,
    height,
    lines,
    fitScale: Math.min(BACKGROUND_FIT_WIDTH / width, BACKGROUND_FIT_HEIGHT / height),
  };
}

// Zwembad — meest gangbare Nederlandse schoolzwembad-configuratie: 6 banen
// van 2,5 m breed x 25 m lang (widthM = de lengte, langs de brede canvas-as;
// heightM = de totale baanbreedte, 6 x 2,5 m). 5 baanscheidingslijnen tussen
// de 6 banen, plus de buitenrand.
function buildPoolBackground(): FacilityBackgroundGeometry {
  const laneWidthM = 2.5;
  const laneCount = 6;
  const widthM = 25;
  const heightM = laneWidthM * laneCount;
  const hw = m(widthM) / 2;
  const hh = m(heightM) / 2;

  const lines: FieldLine[] = [rectOutline(m(widthM), m(heightM))];
  for (let i = 1; i < laneCount; i++) {
    const y = -hh + m(laneWidthM) * i;
    lines.push({ points: [-hw, y, hw, y] });
  }

  return buildFacilityBackground(widthM, heightM, lines);
}

// Atletiekbaan — BEWUST alleen de rechte sprintbaan-variant, geen ovale
// 400m-baan: een geometrisch correcte 400m-ovaal (rechte stukken + bochten
// met de juiste boogstraal, elke baan een eigen effectieve straal) is met
// deze op-rechte-lijnen/cirkels-gebaseerde presetopbouw niet haalbaar zonder
// een vervormde/onjuiste boog te tekenen — zie de toelichting in de PR/het
// eindrapport. In plaats daarvan: 8 rechte banen van 1,22 m breed (de
// officiële baanbreedte, IAAF/World Athletics) over 60 m — de officiële
// indoor-sprintafstand (60m sprint), gekozen omdat de brief geen exacte
// lengte voorschrijft voor de trainingscontext maar wél vraagt om een
// herkenbare, correcte rechte baan; 60 m is zelf een genoemde, echte
// atletiekafstand (in plaats van een arbitrair getal).
function buildTrackBackground(): FacilityBackgroundGeometry {
  const laneWidthM = 1.22;
  const laneCount = 8;
  const widthM = 60;
  const heightM = laneWidthM * laneCount;
  const hw = m(widthM) / 2;
  const hh = m(heightM) / 2;

  const lines: FieldLine[] = [rectOutline(m(widthM), m(heightM))];
  for (let i = 1; i < laneCount; i++) {
    const y = -hh + m(laneWidthM) * i;
    lines.push({ points: [-hw, y, hw, y] });
  }

  return buildFacilityBackground(widthM, heightM, lines);
}

export const POOL_BACKGROUND = buildPoolBackground();
export const TRACK_BACKGROUND = buildTrackBackground();

export const FIELD_PRESETS: Record<FieldPresetSport, FieldPresetGeometry> = {
  volleybal: buildVolleybal(),
  basketbal: buildBasketbal(),
  badminton: buildBadminton(),
  handbal: buildHandbal(),
  zaalvoetbal: buildZaalvoetbal(),
};
