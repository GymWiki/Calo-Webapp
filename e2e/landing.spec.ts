import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./helpers";

// Landingspagina (/): 3D-editor als hoofdargument. Statische pagina, geen editor nodig.
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop + telefoons volstaan");
});

test("hero: H1, CTA's en geen horizontale scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Maak je gymzaal-opstelling in 3D. Gratis, zonder account.");
  await expect(page.getByRole("link", { name: /Start gratis/ }).first()).toHaveAttribute("href", "/gratis-gymzaal-plattegrond-maken#start");
  await expect(page.getByRole("link", { name: "Bekijk voorbeeld" })).toHaveAttribute("href", "#voorbeeld");
  await expect(page.locator("canvas")).toHaveCount(0); // geen WebGL op de landingspagina
  await expectNoHorizontalOverflow(page);
});

test("teaser: knoppen wisselen de schets", async ({ page }) => {
  await page.goto("/");
  const group = page.getByRole("group", { name: "Kies een voorbeeldopstelling" });
  await group.scrollIntoViewIfNeeded();
  await expect(group.getByRole("button", { name: "Turncircuit" })).toHaveAttribute("aria-pressed", "true");
  await group.getByRole("button", { name: "Volleybal" }).click();
  await expect(group.getByRole("button", { name: "Volleybal" })).toHaveAttribute("aria-pressed", "true");
  await expect(group.getByRole("button", { name: "Turncircuit" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("link", { name: /Open dit voorbeeld/ })).toHaveAttribute("href", /#voorbeeld=volleybal$/);
});

test("animatie staat stil bij prefers-reduced-motion", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  const names = await page.evaluate(() => [...document.querySelectorAll(".iso-anim, .iso-float")].map((el) => getComputedStyle(el).animationName));
  expect(names.length).toBeGreaterThan(0);
  expect(names.every((name) => name === "none")).toBe(true);
  await context.close();
});

test("animatie loopt standaard en pauzeert buiten beeld", async ({ page }) => {
  await page.goto("/");
  const running = await page.evaluate(() => getComputedStyle(document.querySelector(".iso-anim")!).animationName);
  expect(running).toBe("iso-drop");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator("[data-paused]").first()).toHaveAttribute("data-paused", "true");
  const state = await page.evaluate(() => getComputedStyle(document.querySelector(".iso-anim")!).animationPlayState);
  expect(state).toBe("paused");
});
