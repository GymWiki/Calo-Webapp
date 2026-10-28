import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./helpers";

// Landingspagina (/): GymWiki als geheel. Statische pagina met live data (of een nette fallback), geen editor nodig.
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop + telefoons volstaan");
});

test("laadt zonder fouten, met één H1 en de afgesproken secties", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !/Failed to load resource|favicon/.test(message.text())) errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Alle activiteiten voor je gymles op één plek");
  expect(await page.locator("h1").count()).toBe(1);
  const h2 = await page.locator("main h2").allInnerTexts();
  expect(h2.length).toBeGreaterThanOrEqual(8);
  expect(h2.join("|")).toMatch(/drie stappen/);
  expect(h2.join("|")).toMatch(/opstelling in 3D/);
  await expect(page.locator("canvas")).toHaveCount(0); // geen WebGL op de landingspagina
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("alle CTA's wijzen naar de juiste routes", async ({ page }) => {
  await page.goto("/");
  const main = page.locator("main");
  await expect(main.getByRole("link", { name: /Gratis beginnen/ }).first()).toHaveAttribute("href", "/register");
  await expect(main.getByRole("link", { name: "Bekijk de bibliotheek" }).first()).toHaveAttribute("href", "/activiteiten");
  await expect(main.getByRole("link", { name: /Probeer de editor gratis/ })).toHaveAttribute("href", "/gratis-gymzaal-plattegrond-maken");
  await expect(page.getByRole("banner").getByRole("link", { name: "Gratis beginnen" })).toHaveAttribute("href", "/register");
  await expect(main.getByRole("link", { name: "Kies jaarlijks" })).toHaveAttribute("href", "/register?plan=yearly");
  await expect(main.getByRole("link", { name: "Team aanmaken" })).toHaveAttribute("href", /^\/register\?redirectTo=%2Fprofiel%2Fteam$|^\/register\?redirectTo=\/profiel\/team$/);
  const footerLinks = await page.getByRole("contentinfo").getByRole("link").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")));
  expect(footerLinks).toEqual(expect.arrayContaining(["/activiteiten", "/gratis-gymzaal-plattegrond-maken", "/over-gymwiki"]));
});

test("bibliotheekpreview toont echte activiteiten (of een nette fallback)", async ({ page }) => {
  await page.goto("/");
  const section = page.locator("#bibliotheek");
  const cards = section.locator('a[href^="/activiteiten/"]');
  if ((await cards.count()) > 0) {
    expect(await cards.count()).toBeLessThanOrEqual(6);
    await expect(cards.first().locator("h3")).not.toBeEmpty();
    const href = await cards.first().getAttribute("href");
    expect(href).toMatch(/^\/activiteiten\/[a-z0-9-]+$/);
  } else {
    await expect(page.getByTestId("bibliotheek-leeg")).toBeVisible();
  }
  await expect(section.getByRole("link", { name: /Bekijk alle/ })).toHaveAttribute("href", "/activiteiten");
});

test("FAQ klapt open en dicht", async ({ page }) => {
  await page.goto("/");
  const item = page.locator("#veelgestelde-vragen details").first();
  await item.scrollIntoViewIfNeeded();
  await expect(item).not.toHaveAttribute("open", "");
  await item.locator("summary").click();
  await expect(item).toHaveAttribute("open", "");
  await expect(item.getByText(/webapp voor bewegingsonderwijs/)).toBeVisible();
  await item.locator("summary").click();
  await expect(item).not.toHaveAttribute("open", "");
  expect(await page.locator("#veelgestelde-vragen details").count()).toBeGreaterThanOrEqual(6);
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

test("editor-animatie loopt standaard en pauzeert buiten beeld", async ({ page }) => {
  await page.goto("/");
  await page.locator("#editor").scrollIntoViewIfNeeded();
  await expect(page.locator("#editor [data-paused]").first()).toHaveAttribute("data-paused", "false");
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("#editor .iso-anim")!).animationName)).toBe("iso-drop");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator("#editor [data-paused]").first()).toHaveAttribute("data-paused", "true");
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("#editor .iso-anim")!).animationPlayState)).toBe("paused");
});

test("klikken op een CTA geeft een landing-event af (lokaal, zonder netwerk)", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    (window as unknown as { __events: unknown[] }).__events = [];
    window.addEventListener("gymwiki:event", (e) => (window as unknown as { __events: unknown[] }).__events.push((e as CustomEvent).detail));
  });
  await page.locator("main").getByRole("link", { name: "Bekijk de bibliotheek" }).first().evaluate((el) => el.addEventListener("click", (e) => e.preventDefault()));
  await page.locator("main").getByRole("link", { name: "Bekijk de bibliotheek" }).first().click();
  const events = await page.evaluate(() => (window as unknown as { __events: { name: string }[] }).__events);
  expect(events.some((e) => e.name === "landing_cta_bibliotheek")).toBe(true);
});
