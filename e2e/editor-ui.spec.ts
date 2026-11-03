import { expect, test, type Locator, type Page } from "@playwright/test";

import { openEditor, placeFromLibrary } from "./helpers";

// UI-eisen van de editor: primaire acties zijn zonder scrollen in beeld en bereikbaar (desktop: canvaswerkbalk; telefoon: selectiebalk).
async function inViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  const size = page.viewportSize()!;
  expect(box, "element heeft een positie").not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-0.5);
  expect(box!.y).toBeGreaterThanOrEqual(-0.5);
  expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 0.5);
  expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 0.5);
  return box!;
}

for (const size of [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
]) {
  test(`desktop ${size.width}x${size.height}: opslaan, undo/redo, camera, raster en botsing staan zonder scrollen in beeld`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-viewports");
    await page.setViewportSize(size);
    await openEditor(page);
    await inViewport(page, page.getByRole("button", { name: "Opslaan" }));
    await inViewport(page, page.getByRole("button", { name: /Ongedaan maken/ }));
    await inViewport(page, page.getByRole("button", { name: /Opnieuw/ }).first());
    await inViewport(page, page.getByPlaceholder(/Zoek materiaal/));
    for (const id of ["werkbalk-camera-standaard", "werkbalk-camera-boven", "werkbalk-camera-vrij", "werkbalk-camera-reset", "werkbalk-raster", "werkbalk-botsing"]) {
      await inViewport(page, page.getByTestId(id));
    }
    // De werkbalk verschuift het canvas niet: canvas houdt zijn grootte.
    const before = await page.locator("canvas").first().boundingBox();
    await page.getByTestId("werkbalk-positie").click();
    const after = await page.locator("canvas").first().boundingBox();
    expect(after!.width).toBe(before!.width);
    expect(after!.height).toBe(before!.height);
  });
}

test("desktop: camera, raster en botsing werken vanaf de werkbalk; positie wordt onthouden; Reset indeling zet terug", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop");
  await openEditor(page);
  await page.getByTestId("werkbalk-camera-boven").click();
  await expect(page.getByTestId("werkbalk-camera-boven")).toHaveAttribute("aria-pressed", "true");
  const raster = page.getByTestId("werkbalk-raster");
  await expect(raster).toHaveAttribute("aria-label", "Raster 0.1 m");
  await raster.click();
  await expect(raster).toHaveAttribute("aria-label", "Raster 0.5 m");
  await raster.click();
  await expect(raster).toHaveAttribute("aria-label", "Raster uit");
  const botsing = page.getByTestId("werkbalk-botsing");
  await botsing.click();
  await expect(botsing).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("knop-botsing")).toHaveAttribute("aria-pressed", "false"); // zijbalk deelt dezelfde state

  // Positie: boven, verbergen, herladen = onthouden, Reset indeling.
  await page.getByTestId("werkbalk-positie").click();
  const top = await page.getByTestId("canvas-werkbalk").boundingBox();
  expect(top!.y).toBeLessThan(200);
  await page.getByTestId("werkbalk-verbergen").click();
  await expect(page.getByTestId("canvas-werkbalk")).toHaveCount(0);
  await page.reload({ waitUntil: "load" });
  await expect(page.getByTestId("werkbalk-tonen")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("werkbalk-tonen").click();
  await page.getByTestId("werkbalk-reset-indeling").click();
  const bottom = await page.getByTestId("canvas-werkbalk").boundingBox();
  expect(bottom!.y).toBeGreaterThan(400);
});

test("telefoon: alle knoppen van de selectiebalk liggen binnen het scherm en zijn minstens 44 px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop" || testInfo.project.name === "ipad", "telefoon");
  await openEditor(page);
  await placeFromLibrary(page, /^Toestellen/, /Turnbank test toevoegen/);
  const bar = page.getByRole("toolbar", { name: /Acties voor/ });
  await expect(bar).toBeVisible();
  const buttons = bar.getByRole("button");
  const count = await buttons.count();
  expect(count).toBeGreaterThanOrEqual(8);
  for (let index = 0; index < count; index++) {
    const box = await inViewport(page, buttons.nth(index));
    expect(box.width).toBeGreaterThanOrEqual(43.5);
    expect(box.height).toBeGreaterThanOrEqual(43.5);
  }
  await inViewport(page, page.getByRole("button", { name: "Opslaan" }));
  await inViewport(page, page.getByRole("button", { name: "Ongedaan maken" }));
});

test("desktop: Selecteren, Veld, Touw en zoom staan in de werkbalk en werken", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop");
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await openEditor(page);
  for (const id of ["werkbalk-selecteren", "werkbalk-veld", "werkbalk-touw", "werkbalk-zoom-in", "werkbalk-zoom-uit"]) await inViewport(page, page.getByTestId(id));
  const selecteren = page.getByTestId("werkbalk-selecteren");
  await expect(selecteren).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("werkbalk-veld").click();
  await expect(page.getByTestId("werkbalk-veld")).toHaveAttribute("aria-pressed", "true");
  await expect(selecteren).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("werkbalk-touw").click();
  await expect(page.getByTestId("werkbalk-touw")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("werkbalk-veld")).toHaveAttribute("aria-pressed", "false");
  await selecteren.click();
  await expect(selecteren).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("werkbalk-touw")).toHaveAttribute("aria-pressed", "false");

  const canvas = page.locator("canvas").first();
  const before = await canvas.screenshot();
  await page.getByTestId("werkbalk-zoom-in").click();
  await page.getByTestId("werkbalk-zoom-in").click();
  await page.waitForTimeout(500);
  const zoomed = await canvas.screenshot();
  expect(Buffer.compare(before, zoomed)).not.toBe(0);
  await page.getByTestId("werkbalk-camera-boven").click();
  await page.getByTestId("werkbalk-zoom-uit").click();
  expect(errors.filter((e) => !/favicon|WebGL|swiftshader|GPU stall|Failed to load resource/i.test(e))).toEqual([]);
});
