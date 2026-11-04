import { test } from "@playwright/test";

import { openEditor } from "./helpers";

// Alleen op verzoek (WANDREK_SHOTS=voor|na): screenshots van de wandrekken tegen de achterwand, vanuit twee kijkrichtingen.
test("wandrek-screenshots", async ({ page }, testInfo) => {
  test.skip(!process.env.WANDREK_SHOTS || testInfo.project.name !== "desktop", "alleen op verzoek");
  const tag = process.env.WANDREK_SHOTS;
  await page.setViewportSize({ width: 1500, height: 900 });
  await openEditor(page);
  await page.waitForTimeout(3000); // zaalmodel laden
  const canvas = page.locator("canvas").first();
  await canvas.screenshot({ path: `docs/wandrek/${tag}-standaard.png` });
  // Ingezoomd op de wandrekken tegen de achterwand (scrollen zoomt naar het midden; eerst de camera richten door te pannen kan niet: we zoomen en leggen vast).
  const box0 = (await canvas.boundingBox())!;
  await page.mouse.move(box0.x + box0.width * 0.5, box0.y + box0.height * 0.33);
  await page.mouse.wheel(0, -1200);
  await page.waitForTimeout(800);
  await canvas.screenshot({ path: `docs/wandrek/${tag}-ingezoomd.png` });
  await page.getByTestId("werkbalk-camera-reset").click();
  await page.waitForTimeout(600);
  // Andere kant: de camera draaien (slepen) en opnieuw vastleggen.
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5 - 280, box.y + box.height * 0.8, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  await canvas.screenshot({ path: `docs/wandrek/${tag}-gedraaid.png` });
});
