import { expect, test, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./helpers";

// Detailweergave van de plattegrond: de viewer kadert op de inhoud (zie components/plattegrond/viewer-framing.ts), niet op de hele
// zaal. Testpagina /e2e/viewer-framing met drie opstellingen en de gekleurde testmodellen (zonder Supabase of GLB's).
const SCENARIOS = [
  { id: "volleybal", mode: "3d" },
  { id: "circuit", mode: "3d" },
  { id: "veld", mode: "top" },
] as const;

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 640;

async function open(page: Page, query: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(style);
    });
  });
  await page.goto(`/e2e/viewer-framing?${query}`, { waitUntil: "load" });
  const viewer = page.locator('[role="group"][aria-label^="Interactieve"]').first();
  await expect(viewer).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await expect(viewer).toHaveAttribute("data-framing-fill", /\d/, { timeout: 15_000 });
  await page.waitForTimeout(1500);
  return { viewer, errors };
}

for (const scenario of SCENARIOS) {
  test(`${scenario.id}: de inhoud vult minstens 70% van het kader, niets is afgesneden`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "ipad", "desktop en telefoons volstaan");
    const { viewer, errors } = await open(page, `scenario=${scenario.id}`);
    const fill = Number(await viewer.getAttribute("data-framing-fill"));
    expect(fill, `vulling ${fill}`).toBeGreaterThanOrEqual(0.7);
    expect(fill, `vulling ${fill}`).toBeLessThanOrEqual(0.9);
    await expect(viewer).toHaveAttribute("data-framing-mode", scenario.mode);
    // Vaste hoogte (geen layout shift): mobiel ±320 px, desktop ±480 px.
    const box = (await viewer.boundingBox())!;
    const [minHeight, maxHeight] = isPhone(page) ? [300, 340] : [420, 520];
    expect(box.height).toBeGreaterThanOrEqual(minHeight);
    expect(box.height).toBeLessThanOrEqual(maxHeight);
    await expectNoHorizontalOverflow(page);
    await viewer.screenshot({ path: testInfo.outputPath(`kader-${scenario.id}-${testInfo.project.name}.png`) });
    expect(errors).toEqual([]);
  });
}

test("de weergave per plattegrond is te overschrijven (room.view) en Reset keert terug naar de automatische kadrering", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop en telefoons volstaan");
  // Een opstelling met een hoog net is "auto" = 3D; met view=top staat hij van boven.
  const auto = await open(page, "scenario=volleybal");
  await expect(auto.viewer).toHaveAttribute("data-framing-mode", "3d");
  await auto.viewer.getByRole("button", { name: "Bovenaanzicht" }).click();
  await expect(auto.viewer).toHaveAttribute("data-framing-mode", "top");
  await auto.viewer.getByRole("button", { name: "Inzoomen" }).click();
  await auto.viewer.getByRole("button", { name: "Weergave terugzetten" }).click();
  await expect(auto.viewer).toHaveAttribute("data-framing-mode", "3d");
  expect(auto.errors).toEqual([]);
});

test("room.view = top zet de viewer standaard op bovenaanzicht", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "één keer volstaat");
  const { viewer } = await open(page, "scenario=volleybal&view=top");
  await expect(viewer).toHaveAttribute("data-framing-mode", "top");
});

test("lege plattegrond: valt terug op de hele zaal zonder fouten", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "één keer volstaat");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/e2e/viewer-framing?scenario=leeg", { waitUntil: "load" });
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});
