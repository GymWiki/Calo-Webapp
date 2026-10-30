import { expect, test } from "@playwright/test";

// Het navigatiemenu links (vanaf tablet) blijft op schermhoogte staan als de pagina scrolt: alle knoppen en "Uitloggen" blijven zichtbaar.
test("het zijmenu blijft staan en heeft de hoogte van het scherm, ook als de pagina scrolt", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "iphone-14" || testInfo.project.name === "pixel-7", "het zijmenu is er vanaf tablet");
  await page.goto("/e2e/app-layout", { waitUntil: "load" });
  const menu = page.locator("aside").first();
  await expect(menu).toBeVisible();
  const viewport = page.viewportSize()!;

  const top = await menu.boundingBox();
  expect(Math.round(top!.height)).toBe(viewport.height);

  await page.evaluate(() => window.scrollTo(0, 2500));
  await page.waitForTimeout(200);
  const scrolled = await menu.boundingBox();
  expect(Math.round(scrolled!.y)).toBe(0);
  expect(Math.round(scrolled!.height)).toBe(viewport.height);
  await expect(page.getByRole("button", { name: "Uitloggen" })).toBeInViewport();
  await expect(menu.getByRole("link", { name: "Dashboard" })).toBeInViewport();
});
