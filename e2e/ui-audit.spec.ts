import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

import { EDITOR_URL } from "./helpers";

// UI-audit van de 3D-editor (alleen op verzoek): UI_AUDIT=1 PLAYWRIGHT_CHROMIUM_PATH=... npx playwright test e2e/ui-audit.spec.ts --project=desktop
// Meet per viewport welke bedieningselementen zonder scrollen in beeld zijn, welke door een scrollcontainer worden afgekapt en welke tikdoelen < 44 px zijn.
const VIEWPORTS = [
  { id: "1366x768", width: 1366, height: 768, touch: false },
  { id: "1920x1080", width: 1920, height: 1080, touch: false },
  { id: "1024x768", width: 1024, height: 768, touch: true },
  { id: "820x1180", width: 820, height: 1180, touch: true },
  { id: "375x667", width: 375, height: 667, touch: true },
  { id: "390x844", width: 390, height: 844, touch: true },
  { id: "412x915", width: 412, height: 915, touch: true },
];
const OUT = "docs/editor-ui-audit";

type Entry = { label: string; tag: string; testid: string | null; x: number; y: number; w: number; h: number; inView: boolean; clipped: boolean; scrollParent: string | null; small: boolean };

async function measure(page: Page, touch: boolean): Promise<{ entries: Entry[]; overflowX: boolean; docScrollY: boolean }> {
  return page.evaluate((isTouch) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("button, a[href], [role=button], [role=tab], [role=switch], input, select, textarea, summary"));
    const entries = [];
    for (const el of nodes) {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Knip af op alle ancestors met overflow != visible.
      let clipped = false;
      let scrollParent: string | null = null;
      let visible = { l: Math.max(r.left, 0), t: Math.max(r.top, 0), r: Math.min(r.right, vw), b: Math.min(r.bottom, vh) };
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflowY !== "visible" || s.overflowX !== "visible") {
          const pr = p.getBoundingClientRect();
          visible = { l: Math.max(visible.l, pr.left), t: Math.max(visible.t, pr.top), r: Math.min(visible.r, pr.right), b: Math.min(visible.b, pr.bottom) };
          if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 1 && !scrollParent) scrollParent = (p.getAttribute("data-testid") || p.className.toString().split(" ").slice(0, 3).join(".") || p.tagName).slice(0, 60);
        }
      }
      const area = Math.max(0, visible.r - visible.l) * Math.max(0, visible.b - visible.t);
      const full = r.width * r.height;
      const inView = area >= full * 0.98;
      clipped = area < full * 0.5;
      const label = (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 50);
      entries.push({ label, tag: el.tagName.toLowerCase(), testid: el.getAttribute("data-testid"), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), inView, clipped, scrollParent, small: isTouch && (r.width < 44 || r.height < 44) });
    }
    return { entries, overflowX: document.documentElement.scrollWidth > vw + 1, docScrollY: document.documentElement.scrollHeight > vh + 1 };
  }, touch);
}

for (const vp of VIEWPORTS) {
  test(`ui-audit ${vp.id}`, async ({ browser }, testInfo) => {
    test.skip(!process.env.UI_AUDIT || testInfo.project.name !== "desktop", "alleen op verzoek (UI_AUDIT=1)");
    mkdirSync(OUT, { recursive: true });
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch && vp.width < 800, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.addInitScript(() => {
      try { window.localStorage.setItem("gymwiki.editor.onboarding.v1", "1"); } catch { /* geen localStorage */ }
      document.addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style");
        style.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(style);
      });
    });
    await page.goto(EDITOR_URL, { waitUntil: "load" });
    await page.locator("canvas").first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(2000);
    const empty = await measure(page, vp.touch);
    await page.screenshot({ path: `${OUT}/${vp.id}-leeg.png` });
    // Plaats een item (de bank) en meet opnieuw met selectie.
    const desktopLayout = vp.width >= 1024;
    try {
      if (desktopLayout) {
        await page.getByRole("button", { name: /^Toestellen/ }).first().click();
        await page.getByRole("button", { name: /Turnbank test toevoegen/ }).click();
      } else {
        await page.getByTestId("toolbar-bibliotheek").click();
        await page.getByRole("button", { name: /^Toestellen/ }).first().click();
        await page.getByRole("button", { name: /Turnbank test toevoegen/ }).first().click();
      }
      await page.waitForTimeout(1200);
    } catch (error) {
      writeFileSync(`${OUT}/${vp.id}-plaatsfout.txt`, String(error));
    }
    const selected = await measure(page, vp.touch);
    await page.screenshot({ path: `${OUT}/${vp.id}-selectie.png` });
    writeFileSync(`${OUT}/data-${vp.id}.json`, JSON.stringify({ viewport: vp, empty, selected }, null, 1));
    await context.close();
  });
}
