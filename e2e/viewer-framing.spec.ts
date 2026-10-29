import { expect, test, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./helpers";

// Detailweergave van de plattegrond: de viewer kadert op de inhoud (zie components/plattegrond/viewer-framing.ts), niet op de hele
// zaal. Testpagina /e2e/viewer-framing met drie opstellingen en de gekleurde testmodellen (zonder Supabase of GLB's).
const SCENARIOS = [
  { id: "volleybal", mode: "3d" },
  { id: "circuit", mode: "3d" },
  { id: "veld", mode: "3d" },
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

const num = async (viewer: ReturnType<Page["locator"]>, name: string) => Number(await viewer.getAttribute(`data-view-${name}`));

test("muis: slepen draait en kantelt, wiel zoomt, rechts slepen verschuift, dubbelklik zet terug", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "muisgedrag: desktop volstaat");
  const { viewer, errors } = await open(page, "scenario=volleybal");
  await expect(viewer.getByRole("button", { name: "Bovenaanzicht" })).toHaveCount(0);
  await expect(viewer.getByRole("button", { name: "Inzoomen" })).toHaveCount(0);
  const box = (await viewer.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const azimuth0 = await num(viewer, "azimuth");
  const polar0 = await num(viewer, "polar");
  const zoom0 = await num(viewer, "zoom");

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy + 60, { steps: 8 });
  await page.mouse.up();
  expect(await num(viewer, "azimuth")).not.toBeCloseTo(azimuth0, 0);
  expect(await num(viewer, "polar")).toBeLessThan(polar0);

  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -400);
  await expect.poll(() => num(viewer, "zoom")).toBeGreaterThan(zoom0 * 1.3);

  await page.mouse.down({ button: "right" });
  await page.mouse.move(cx + 80, cy, { steps: 6 });
  await page.mouse.up({ button: "right" });
  expect(await viewer.getAttribute("data-view-pan")).not.toBe("0,0");

  await viewer.dblclick({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect.poll(() => num(viewer, "zoom")).toBeCloseTo(zoom0, 1);
  await expect.poll(() => num(viewer, "azimuth")).toBeCloseTo(azimuth0, 0);
  await expect(viewer).toHaveAttribute("data-framing-mode", "3d");
  expect(errors).toEqual([]);
});

test("aanraken: tikken activeert, één vinger draait, tik buiten de viewer deactiveert, uitleg is zichtbaar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-14", "telefoon");
  const { viewer, errors } = await open(page, "scenario=volleybal");
  await expect(viewer.getByTestId("viewer-hint")).toBeVisible();
  await expect(viewer).not.toHaveAttribute("data-view-active", "true");
  const box = (await viewer.boundingBox())!;
  await viewer.tap({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(viewer).toHaveAttribute("data-view-active", "true");

  const client = await page.context().newCDPSession(page);
  const azimuth0 = await num(viewer, "azimuth");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 6; step++) {
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + step * 15, y }] });
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(Math.abs((await num(viewer, "azimuth")) - azimuth0)).toBeGreaterThan(5);

  // Knijpen: twee vingers uit elkaar = inzoomen.
  const zoom0 = await num(viewer, "zoom");
  const pair = (d: number) => [{ x: x - d, y, id: 1 }, { x: x + d, y, id: 2 }];
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pair(30) });
  for (const d of [40, 55, 70, 90]) await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pair(d) });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(await num(viewer, "zoom")).toBeGreaterThan(zoom0 * 1.3);

  await page.mouse.click(5, 5);
  await page.touchscreen.tap(5, 5);
  await expect(viewer).not.toHaveAttribute("data-view-active", "true");
  expect(errors).toEqual([]);
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
