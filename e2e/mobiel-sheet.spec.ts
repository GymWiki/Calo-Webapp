import { expect, test } from "@playwright/test";

import { openEditor } from "./helpers";

// Mobiele bottom sheet: opent over het hele canvasgebied en het zoekveld houdt zijn focus (het toetsenbord klapt niet meteen weer in).
test("Materiaal opent over het hele canvasgebied; het zoekveld behoudt de focus tijdens typen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop" || testInfo.project.name === "ipad", "telefoon");
  await openEditor(page);
  await page.getByTestId("toolbar-bibliotheek").click();
  await page.waitForTimeout(700); // sheet-animatie
  const sheet = await page.getByRole("dialog").boundingBox();
  const area = await page.getByTestId("editor-canvas-area").boundingBox();
  expect(sheet!.height, "sheet vult (bijna) het hele canvasgebied").toBeGreaterThanOrEqual(area!.height - 12);

  const search = page.getByPlaceholder(/Zoek materiaal/);
  await search.tap();
  // Een venstergrootte-wijziging (toetsenbord) en herrenders mogen de focus niet afpakken.
  await page.setViewportSize({ width: page.viewportSize()!.width, height: Math.round(page.viewportSize()!.height * 0.6) });
  await page.waitForTimeout(800);
  await expect(search).toBeFocused();
  await page.keyboard.type("bank");
  await page.waitForTimeout(800);
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("bank");
});
