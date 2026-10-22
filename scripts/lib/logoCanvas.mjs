// Gedeelde canvas-hulpfuncties voor de asset-generatiescripts
// (generate-favicons.mjs, generate-app-icon.mjs) — allebei tekenen ze
// hetzelfde bronlogo (assets/branding/gymwiki-logo-source.png) op
// verschillende canvasformaten/achtergronden, dus die logica hoort maar op
// één plek te staan.
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../..");
export const SOURCE_LOGO_PATH = path.join(REPO_ROOT, "assets/branding/gymwiki-logo-source.png");

// Uit het brongebied gemeten (zie de STAP1-beoordeling in de PR-
// samenvatting): navy-achtergrond van de afgeronde badge, wit/cyaan
// beeldmerk erbovenop. Bewust hier als constanten i.p.v. opnieuw uit de
// pixels af te leiden bij elke run.
export const LOGO_NAVY = "#002f4f";
export const LOGO_CYAN = "#0cc0df";

let cachedImage = null;
async function getSourceImage() {
  if (!cachedImage) {
    cachedImage = await loadImage(readFileSync(SOURCE_LOGO_PATH));
  }
  return cachedImage;
}

/**
 * Tekent het bronlogo op een vierkant canvas van `size`px. `background`
 * (indien gezet) vult eerst het hele canvas — nodig overal waar de
 * transparante hoekjes van de afgeronde badge niet gewenst zijn (app-
 * iconen, PWA-iconen): die hoekjes worden dan gewoon opgevuld met de
 * navy-merkkleur, wat een volledig ondoorzichtig vierkant oplevert zonder
 * dat het beeldmerk zelf verschuift. `padding` (0–0.5) trekt het logo
 * naar binnen — gebruikt voor Android's adaptive-icon-veilige-zone en het
 * maskable PWA-icoon.
 */
export async function renderLogoCanvas(size, { background = null, padding = 0 } = {}) {
  const img = await getSourceImage();
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
  }
  const drawSize = size * (1 - padding * 2);
  const offset = size * padding;
  ctx.drawImage(img, offset, offset, drawSize, drawSize);
  return canvas;
}

/**
 * Levert alleen het wit/cyaan beeldmerk, met de navy-badge-achtergrond
 * weg-chroma-keyed naar transparant (met een zachte rand op de anti-
 * aliasingpixels i.p.v. een harde alles-of-niets-drempel, wat een zichtbare
 * gekartelde rand zou geven). Nodig voor Android's adaptive-icon-
 * voorgrondlaag: die krijgt zijn eigen, aparte achtergrondkleur
 * (ic_launcher_background.xml) en mag het beeldmerk dus niet nogmaals met
 * een eigen navy-vierkant erachter aanleveren.
 */
export async function renderLogoMarkOnly(size, { padding = 0.19 } = {}) {
  const img = await getSourceImage();
  const full = createCanvas(img.width, img.height);
  const fullCtx = full.getContext("2d");
  fullCtx.drawImage(img, 0, 0);
  const imageData = fullCtx.getImageData(0, 0, img.width, img.height);
  const data = imageData.data;

  const navy = hexToRgb(LOGO_NAVY);
  // Alles binnen deze afstand van de navy-badgekleur wordt transparant;
  // ertussenin (anti-aliasingpixels op de rand van het beeldmerk) schaalt
  // de alpha lineair mee i.p.v. hard te knippen.
  const THRESHOLD_IN = 18;
  const THRESHOLD_OUT = 55;
  for (let i = 0; i < data.length; i += 4) {
    const dist = colorDistance(data[i], data[i + 1], data[i + 2], navy);
    if (dist <= THRESHOLD_IN) {
      data[i + 3] = 0;
    } else if (dist < THRESHOLD_OUT) {
      const t = (dist - THRESHOLD_IN) / (THRESHOLD_OUT - THRESHOLD_IN);
      data[i + 3] = Math.round(data[i + 3] * t);
    }
  }
  fullCtx.putImageData(imageData, 0, 0);

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const drawSize = size * (1 - padding * 2);
  const offset = size * padding;
  ctx.drawImage(full, offset, offset, drawSize, drawSize);
  return canvas;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function colorDistance(r, g, b, target) {
  return Math.sqrt((r - target.r) ** 2 + (g - target.g) ** 2 + (b - target.b) ** 2);
}
