import { expect, test, type Page } from "@playwright/test";

import { canvasCenter, openEditor, placeFromLibrary, readDraft, touchDrag } from "./helpers";

// Geen schaduwen in de 3D-scène: schaduwmap uit, geen castShadow/receiveShadow, geen schaduwlichten of schaduwmeshes.
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  if (isDesktop(page)) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
  } else {
    await touchDrag(page, from, to);
  }
}

async function place(page: Page, category: RegExp, item: RegExp, count: number, to: { x: number; y: number }) {
  if (isDesktop(page)) {
    await page.getByRole("button", { name: category }).first().click();
    await page.getByRole("button", { name: item }).first().click();
  } else {
    await placeFromLibrary(page, category, item);
  }
  await readDraft(page, (d) => d.items.length === count);
  const { x, y } = await canvasCenter(page);
  await drag(page, { x, y }, to);
  await page.waitForTimeout(250);
}

test("editor: geen schaduwen in de scène, ook niet met veel items", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop en telefoon volstaan");
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await openEditor(page);
  const { x, y } = await canvasCenter(page);
  const spread = isDesktop(page) ? 150 : 90;
  const spots = [
    { x: x - spread, y },
    { x: x + spread, y },
    { x, y: y - spread / 2 },
    { x, y: y + spread / 2 },
    { x: x - spread, y: y + spread / 2 },
  ];
  await place(page, /^Matten/, /Testmat groot toevoegen/, 1, spots[0]);
  await place(page, /^Toestellen/, /Turnbank test toevoegen/, 2, spots[1]);
  await place(page, /^Klein materiaal/, /Pion test toevoegen/, 3, spots[2]);
  await place(page, /^Ballen/, /Basketbal test toevoegen/, 4, spots[3]);
  await place(page, /^Fitness/, /Kettlebell test toevoegen/, 5, spots[4]);
  await page.waitForTimeout(500);

  const audit = await page.evaluate(() => window.__sceneAudit?.());
  expect(audit, "SceneAudit beschikbaar").toBeTruthy();
  expect(audit).toMatchObject({ shadowMapEnabled: false, castShadow: 0, receiveShadow: 0, shadowLights: 0, shadowNamedMeshes: 0 });
  await page.screenshot({ path: `docs/schaduwen/editor-${testInfo.project.name}-${process.env.SHOT ?? "na"}.png` });
  expect(errors.filter((e) => !/favicon|WebGL|swiftshader|GPU stall|Failed to load resource/i.test(e))).toEqual([]);
});

test("viewer (alleen-lezen): geen schaduwen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop en telefoon volstaan");
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(style);
    });
  });
  await page.goto("/e2e/viewer-framing?scenario=circuit&mode=3d", { waitUntil: "load" });
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  const audit = await page.evaluate(() => window.__sceneAudit?.());
  expect(audit, "SceneAudit beschikbaar").toBeTruthy();
  expect(audit).toMatchObject({ shadowMapEnabled: false, castShadow: 0, receiveShadow: 0, shadowLights: 0, shadowNamedMeshes: 0 });
  await page.screenshot({ path: `docs/schaduwen/viewer-${testInfo.project.name}-${process.env.SHOT ?? "na"}.png` });
});

test("kleine items zonder schaduw: screenshots vanuit drie camerahoeken (zweefcontrole)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "alleen desktop");
  await openEditor(page);
  const { x, y } = await canvasCenter(page);
  await place(page, /^Klein materiaal/, /Pion test toevoegen/, 1, { x: x - 60, y });
  await place(page, /^Ballen/, /Basketbal test toevoegen/, 2, { x, y });
  await place(page, /^Fitness/, /Kettlebell test toevoegen/, 3, { x: x + 60, y });
  await page.mouse.move(x, y + 150);
  await page.mouse.wheel(0, -900); // inzoomen
  await page.waitForTimeout(700);
  const shots = [
    { naam: "schuin", dx: 0, dy: 0 },
    { naam: "laag", dx: 0, dy: -70 },
    { naam: "van-boven", dx: 0, dy: 160 },
  ];
  for (const shot of shots) {
    await page.mouse.move(x, y + 200);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(x + shot.dx, y + 200 + shot.dy, { steps: 8 });
    await page.mouse.up({ button: "right" });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `docs/schaduwen/klein-${shot.naam}.png`, clip: { x: x - 220, y: y - 150, width: 440, height: 300 } });
  }
});
