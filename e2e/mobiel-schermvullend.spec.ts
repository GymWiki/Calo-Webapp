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

/** Breedte van de zaal als aandeel van de canvasbreedte: pixels die afwijken van de achtergrond (hoekpixel), kolom voor kolom. */
async function zaalVulling(page: Page): Promise<number> {
  const canvas = page.locator("canvas").first();
  const png = (await canvas.screenshot()).toString("base64");
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const c = document.createElement("canvas");
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const { data: px } = ctx.getImageData(0, 0, c.width, c.height);
    const bg = [px[0], px[1], px[2]];
    let min = c.width;
    let max = -1;
    for (let y = 0; y < c.height; y += 2) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) > 36) {
          if (x < min) min = x;
          if (x > max) max = x;
        }
      }
    }
    return max < 0 ? 0 : (max - min + 1) / c.width;
  }, png);
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
    const fill = vp.width < 768 ? await zaalVulling(page) : null;
    if (fill !== null) writeFileSync(`${OUT}/${process.env.MOBIEL_VOOR ? "voor" : "na"}-vulling-${vp.id}.json`, JSON.stringify({ fill, canvas: m.canvas }));
    if (process.env.MOBIEL_VOOR) {
      writeFileSync(`${OUT}/voor-${vp.id}.json`, JSON.stringify(m, null, 1));
    }
    if (fill !== null) expect(fill, `zaal vult ${(fill * 100).toFixed(0)}% van de canvasbreedte`).toBeGreaterThanOrEqual(0.85);
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

for (const vp of VIEWPORTS.filter((v) => v.width < 768)) {
  test(`werkbalken ${vp.id}: vijf knoppen, geen overlap, ≥ 44 px; sheet openen en sluiten verschuift niets`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "eigen contexten per viewport");
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await open(page);
    const bar = page.getByTestId("mobiele-werkbalk");
    const buttons = bar.getByRole("button");
    expect(await buttons.count()).toBe(5);
    const boxes = [];
    for (let i = 0; i < 5; i++) boxes.push((await buttons.nth(i).boundingBox())!);
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(43.5);
      expect(box.height).toBeGreaterThanOrEqual(43.5);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
    }
    for (let i = 1; i < 5; i++) expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width - 0.5);
    // Ongedaan/Opnieuw staan in de bovenbalk.
    await expect(page.getByTestId("toolbar-undo")).toBeVisible();
    await expect(page.getByTestId("toolbar-redo")).toBeVisible();
    const before = await metrics(page);
    await page.getByTestId("toolbar-bibliotheek").click();
    await expect(page.getByTestId("bottom-sheet-laag")).toBeVisible();
    await page.waitForTimeout(700); // sheet-animatie
    const open1 = await metrics(page);
    expect(open1.toolbar).toEqual(before.toolbar);
    expect(open1.header).toEqual(before.header);
    expect(open1.scrollHeight).toBeLessThanOrEqual(open1.vh);
    // Het sheet staat boven de werkbalk, niet erachter.
    const sheet = await page.getByRole("dialog").boundingBox();
    expect(sheet!.y + sheet!.height).toBeLessThanOrEqual(before.toolbar!.top + 1);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("bottom-sheet-laag")).toHaveCount(0);
    const closed = await metrics(page);
    expect(closed.toolbar).toEqual(before.toolbar);
    expect(closed.header).toEqual(before.header);
    await context.close();
  });
}
