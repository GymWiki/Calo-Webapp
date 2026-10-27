import { expect, type Page } from "@playwright/test";

export const EDITOR_URL = "/e2e/plattegrond-3d";

/** Opent de editor met de onboarding al weggeklikt en zonder Next-dev-overlay die tikken onderschept. */
export async function openEditor(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("gymwiki.editor.onboarding.v1", "1");
    } catch {
      // geen localStorage
    }
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(style);
    });
  });
  await page.goto(EDITOR_URL, { waitUntil: "load" });
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  // Wacht tot de zaal er staat (eerste render van de scene).
  await page.waitForTimeout(1500);
}

export async function canvasCenter(page: Page) {
  const box = await page.locator("canvas").first().boundingBox();
  if (!box) throw new Error("geen canvas");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

type Draft = { naam: string; items: { id: string; slug: string; x: number; z: number; rot_y_deg: number; locked?: boolean }[]; coneFields: unknown[] };

/** De lokale kladversie van de editor (500 ms na elke wijziging) — de testbare staat van de plattegrond. */
export async function readDraft(page: Page, wanted?: (draft: Draft) => boolean): Promise<Draft> {
  let result: Draft | null = null;
  await expect
    .poll(
      async () => {
        const raw = await page.evaluate(() => window.localStorage.getItem("gymwiki.floorplan3d.draft.nieuw"));
        if (!raw) return false;
        result = JSON.parse(raw) as Draft;
        return wanted ? wanted(result) : true;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  return result as unknown as Draft;
}

/** Eén-vinger-sleepbeweging via CDP-touchevents (page.touchscreen kan alleen tikken). */
export async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 10) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps, id: 1 }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** Opent de bibliotheek (werkbalk), klapt een categorie open en tikt het item. */
export async function placeFromLibrary(page: Page, category: RegExp, item: RegExp) {
  await page.getByTestId("toolbar-bibliotheek").click();
  await page.getByRole("button", { name: category }).first().click();
  await page.getByRole("button", { name: item }).first().click();
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow, "horizontale scroll").toBe(false);
}
