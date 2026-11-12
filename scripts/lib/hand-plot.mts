// Tekent een pose (voor- en zijaanzicht) met de huidstukken en de afgeleide handpunten als PNG, voor docs/grip-audit.md.
import sharp from "sharp";
import type { HandPoints } from "./pose-hands.mts";

export async function plotPose(result: HandPoints, file: string, title: string): Promise<void> {
  const debug = result.debug;
  if (!debug) return;
  const W = 260;
  const H = 360;
  const scale = 170; // px per meter
  const view = (axis: 0 | 2, ox: number) => {
    const dots: string[] = [];
    for (let i = 0; i < debug.pos.length / 3; i += 2) {
      const cx = ox + W / 2 + debug.pos[i * 3 + axis] * scale;
      const cy = H - 20 - debug.pos[i * 3 + 1] * scale;
      dots.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="1.1" fill="${debug.skin[i] ? "#f97316" : "#94a3b8"}"/>`);
    }
    const hands = (["links", "rechts"] as const).flatMap((hand) => {
      const p = result[hand];
      if (!p) return [];
      const cx = ox + W / 2 + p[axis] * scale;
      const cy = H - 20 - p[1] * scale;
      return [`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7" fill="none" stroke="${hand === "links" ? "#16a34a" : "#2563eb"}" stroke-width="3"/><text x="${(cx + 9).toFixed(0)}" y="${(cy - 6).toFixed(0)}" font-size="13" fill="${hand === "links" ? "#16a34a" : "#2563eb"}" font-family="sans-serif">${hand === "links" ? "L" : "R"}</text>`];
    });
    return dots.join("") + hands.join("");
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H}"><rect width="100%" height="100%" fill="#ffffff"/>
<line x1="0" y1="${H - 20}" x2="${W * 2}" y2="${H - 20}" stroke="#cbd5e1"/>
${view(0, 0)}${view(2, W)}
<text x="8" y="16" font-size="14" font-family="sans-serif" fill="#0f172a">${title} — voor (X) | zij (Z) — ${result.confidence}</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
}
