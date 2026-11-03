import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

// De mobiele editor vult precies het zichtbare scherm: nul paginascroll, bovenbalk bovenin, werkbalk onderin, geen globale navigatie.
// Draait de editor BINNEN de app-shell (/e2e/shell-plattegrond-3d), want alleen daar speelt het probleem.
const URL = "/e2e/shell-plattegrond-3d";
const OUT = "docs/mobiel-schermvullend";
const VIEWPORTS = [
  { id: "412x915", width: 412, height: 915 },
  { id: "390x844", width: 390, height: 844 },
  { id: "375x667", width: 375, height: 667 },
  { id: "360x640", width: 360, height: 640 },
  { id: "820x1180", width: 820, height: 1180 },
];

async function open(page: Page) {
  await page.addInitScript(() => {
    try { window.localStorage.setItem("gymwiki.editor.onboarding.v1", "1"); } catch { /* geen localStorage */ }
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(style);
    });
  });
  await page.goto(URL, { waitUntil: "load" });
  await page.locator("canvas").first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1800);
}

async function metrics(page: Page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const rect = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
    const header = document.querySelector("header");
    const toolbar = document.querySelector('[data-testid="mobiele-werkbalk"]');
    const globalNav = Array.from(document.querySelectorAll("nav")).find((nav) => /Dashboard/.test(nav.textContent ?? "") && getComputedStyle(nav).display !== "none" && nav.getBoundingClientRect().height > 0);
    const canvas = document.querySelector("canvas");
    const area = document.querySelector('[data-testid="editor-canvas-area"]');
    const h = rect(header);
    const t = rect(toolbar);
    const n = rect(globalNav ?? null);
    const c = rect(canvas);
    return {
      vw,
      vh,
      scrollHeight: document.scrollingElement!.scrollHeight,
      scrollWidth: document.scrollingElement!.scrollWidth,
      header: h && { top: Math.round(h.top), bottom: Math.round(h.bottom) },
      toolbar: t && { top: Math.round(t.top), bottom: Math.round(t.bottom), left: Math.round(t.left), right: Math.round(t.right) },
      globalNav: n && { top: Math.round(n.top), bottom: Math.round(n.bottom) },
      canvas: c && { width: Math.round(c.width), height: Math.round(c.height) },
      area: rect(area) && { height: Math.round(rect(area)!.height) },
    };
  });
}

for (const vp of VIEWPORTS) {
  test(`schermvullend ${vp.id}: geen paginascroll, balken in beeld, geen globale navigatie`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "eigen contexten per viewport");
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: vp.width < 800, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await open(page);
    const m = await metrics(page);
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: `${OUT}/${process.env.MOBIEL_VOOR ? "voor" : "na"}-${vp.id}.png` });
    if (process.env.MOBIEL_VOOR) {
      writeFileSync(`${OUT}/voor-${vp.id}.json`, JSON.stringify(m, null, 1));
    }
    expect(m.scrollHeight, `paginascroll: scrollHeight ${m.scrollHeight} vs viewport ${m.vh}`).toBeLessThanOrEqual(m.vh);
    expect(m.scrollWidth).toBeLessThanOrEqual(m.vw);
    // Telefoon: geen globale onderbalk. Tablet (≥ 768 px) houdt zijn zijmenu.
    if (vp.width < 768) expect(m.globalNav, "globale navigatie hoort op de editorroute verborgen te zijn").toBeNull();
    expect(m.header!.top).toBeGreaterThanOrEqual(0);
    expect(m.toolbar!.bottom).toBeLessThanOrEqual(m.vh);
    expect(m.toolbar!.left).toBeGreaterThanOrEqual(0);
    expect(m.toolbar!.right).toBeLessThanOrEqual(m.vw);
    // De werkbalk sluit aan op de onderrand van het scherm (geen gat, niet erachter).
    expect(m.toolbar!.bottom).toBeGreaterThanOrEqual(m.vh - 1);
    // Scrollen verandert niets: de bovenbalk blijft staan.
    await page.evaluate(() => window.scrollTo(0, 500));
    const after = await metrics(page);
    expect(after.header!.top).toBe(m.header!.top);
    expect(after.toolbar!.bottom).toBe(m.toolbar!.bottom);
    expect(errors.filter((e) => !/favicon|WebGL|swiftshader|GPU stall|Failed to load resource/i.test(e))).toEqual([]);
    await context.close();
  });
}
