// Maakt de voor/na-screenshots van het probleemobject (korfbalpaal) met de echte GLB (alleen lezen uit de publieke bucket).
//   E2E_HARNESS=1 npx next dev --webpack -p 3125 &   daarna:   node scripts/anchor-screenshots.mjs
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.env.BASE_URL ?? "http://localhost:3125";
const out = "docs/anchor-screenshots";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on("console", (m) => ["error", "warning"].includes(m.type()) && console.log(`  [console ${m.type()}]`, m.text().slice(0, 160)));
await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }));
for (const [name, query] of [["korfbalpaal-voor", "stand=voor"], ["korfbalpaal-na", "stand=na"], ["korfbalpaal-na-anchors", "stand=na&anchors=1"], ["korfbalpaal-voor-anchors", "stand=voor&anchors=1"]]) {
  await page.goto(`${base}/e2e/anchors?${query}`, { waitUntil: "load" });
  await page.locator("canvas").first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(8000); // GLB's laden
  await page.getByTestId("anchors-harness").screenshot({ path: `${out}/${name}.png` });
  console.log("geschreven:", `${out}/${name}.png`);
}
await browser.close();
