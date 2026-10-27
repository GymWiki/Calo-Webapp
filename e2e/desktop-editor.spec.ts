import { expect, test } from "@playwright/test";

import { canvasCenter, openEditor, readDraft } from "./helpers";

// Regressie voor de pc-versie: drie kolommen, muis, scrollwiel en sneltoetsen werken als vroeger.
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "alleen desktop");
});

test("desktop-layout: zijpanelen links en rechts, geen mobiele werkbalk", async ({ page }) => {
  await openEditor(page);
  await expect(page.locator("aside")).toHaveCount(2);
  await expect(page.getByTestId("toolbar-bibliotheek")).toHaveCount(0);
  const { box } = await canvasCenter(page);
  expect(box.width).toBeGreaterThan(700);
});

test("bibliotheek klikken plaatst een item; muis-slepen verplaatst het meteen", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: /^Matten/ }).first().click();
  await page.getByRole("button", { name: /Testmat groot toevoegen/ }).click();
  const start = await readDraft(page, (d) => d.items.length === 1);
  const { x, y } = await canvasCenter(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 120, y, { steps: 10 });
  await page.mouse.up();
  const moved = await readDraft(page, (d) => Math.hypot(d.items[0].x - start.items[0].x, d.items[0].z - start.items[0].z) > 0.5);
  expect(moved.items.length).toBe(1);
});

test("sneltoetsen: R draait, Ctrl+Z maakt ongedaan, Delete verwijdert", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: /^Matten/ }).first().click();
  await page.getByRole("button", { name: /Testmat groot toevoegen/ }).click();
  await readDraft(page, (d) => d.items.length === 1);
  await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => undefined);
  await page.keyboard.press("r");
  await readDraft(page, (d) => d.items[0].rot_y_deg === 15);
  await page.keyboard.press("Control+z");
  await readDraft(page, (d) => d.items[0].rot_y_deg === 0);
  await page.keyboard.press("Delete");
  await readDraft(page, (d) => d.items.length === 0);
  await page.keyboard.press("Control+z");
  await readDraft(page, (d) => d.items.length === 1);
});

test("scrollwiel zoomt het canvas", async ({ page }) => {
  await openEditor(page);
  const { x, y } = await canvasCenter(page);
  const before = await page.locator("canvas").first().screenshot();
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(600);
  const after = await page.locator("canvas").first().screenshot();
  expect(Buffer.compare(before, after)).not.toBe(0);
});

test("Veld afzetten werkt met muis-slepen en de bovenbalk blijft de desktop-knoppen tonen", async ({ page }) => {
  await openEditor(page);
  await expect(page.getByRole("button", { name: /Mijn plattegronden/ })).toBeVisible();
  await page.getByRole("button", { name: /^Veld afzetten/ }).first().click();
  const { x, y } = await canvasCenter(page);
  await page.mouse.move(x - 120, y - 50);
  await page.mouse.down();
  await page.mouse.move(x + 120, y + 50, { steps: 12 });
  await page.mouse.up();
  await readDraft(page, (d) => d.coneFields.length === 1);
});
