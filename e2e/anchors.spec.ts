import { expect, test, type Page } from "@playwright/test";

import { canvasCenter, openEditor, placeFromLibrary, readDraft, touchDrag } from "./helpers";

// Touwen hechten aan het bevestigingspunt (anchor) van een object, niet aan de plek waar je het model raakt. Het testmodel heeft de slug van de
// echte korfbalpaal (paal met gele korf): het touwpunt hoort aan de paal onder de korf te zitten, op x=0, z=0 van het model.
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;
const POLE = /Paal met korf \(anchor-test\) toevoegen/;
/** De paal staat op x=0, z=0 van het model; de hoogte is verstelbaar (de gekozen hoogte, nooit boven de korf: max 2,155 m). */
const onPole = (end: { local: [number, number, number]; height?: number }) => {
  expect(end.local[0]).toBe(0);
  expect(end.local[2]).toBe(0);
  expect(end.local[1]).toBeGreaterThan(0.1);
  expect(end.local[1]).toBeLessThanOrEqual(2.155);
  expect(end.height).toBe(end.local[1]);
};

async function placeTwoPoles(page: Page) {
  const { x, y } = await canvasCenter(page);
  const left = { x: x - 170, y };
  const middle = { x, y };
  if (isDesktop(page)) {
    await page.getByRole("button", { name: /^Doelen/ }).first().click();
    await page.getByRole("button", { name: POLE }).click();
    await readDraft(page, (d) => d.items.length === 1);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(left.x, left.y, { steps: 10 });
    await page.mouse.up();
    await page.getByRole("button", { name: POLE }).click();
  } else {
    await placeFromLibrary(page, /^Doelen/, POLE);
    await readDraft(page, (d) => d.items.length === 1);
    await touchDrag(page, middle, left);
    await placeFromLibrary(page, /^Doelen/, POLE);
  }
  await readDraft(page, (d) => d.items.length === 2);
  return { left, middle };
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  if (isDesktop(page)) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
  } else {
    await touchDrag(page, from, to);
  }
}

test("een touw tussen twee palen zit aan de paal (anchor), waar je ook sleept, en blijft identiek na herladen", async ({ page }, testInfo) => {
  // Telefoon: het touw spannen met de vinger staat in touw.spec.ts (matten) en controleert daar ook het anchor; de hoge palen vragen een andere camera.
  test.skip(testInfo.project.name !== "desktop", "muis volstaat; telefoon: zie touw.spec.ts");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

  await openEditor(page);
  const { left, middle } = await placeTwoPoles(page);
  await (isDesktop(page) ? page.getByTestId("knop-touw") : page.getByTestId("toolbar-touw")).click();
  // Sleep van een willekeurig punt op de ene paal naar een ander willekeurig punt op de andere (niet het midden/bovenkant).
  await drag(page, { x: left.x - 22, y: left.y + 14 }, { x: middle.x + 18, y: middle.y - 10 });
  const draft = await readDraft(page, (d) => (d.ropes?.length ?? 0) === 1);
  const rope = draft.ropes![0];

  expect(rope.a.anchor).toBe("paal_top");
  expect(rope.b.anchor).toBe("paal_top");
  // Het opgeslagen punt is het bevestigingspunt zelf (op de paal, x=0 z=0), niet het geklikte oppervlaktepunt.
  onPole(rope.a);
  onPole(rope.b);

  // Een paal verplaatsen: het touw volgt (zelfde anchor, zelfde lokale punt), niets verandert aan de verbinding.
  await (isDesktop(page) ? page.keyboard.press("Escape") : page.getByTestId("toolbar-touw").click());
  if (!isDesktop(page)) await page.touchscreen.tap(left.x, left.y);
  await drag(page, left, { x: left.x, y: left.y + 70 });
  const moved = await readDraft(page, (d) => d.items.some((item) => Math.hypot(item.x - draft.items.find((b) => b.id === item.id)!.x, item.z - draft.items.find((b) => b.id === item.id)!.z) > 0.15));
  expect(moved.ropes![0].a).toEqual(rope.a);
  expect(moved.ropes![0].b).toEqual(rope.b);

  // Herladen en de kladversie herstellen geeft identieke verbindingen (zelfde anchor, hoogte en lokaal punt).
  await page.reload({ waitUntil: "load" });
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Herstellen" }).click();
  await page.waitForTimeout(1200);
  const reloaded = await readDraft(page, (d) => (d.ropes?.length ?? 0) === 1);
  expect(reloaded.ropes).toEqual(moved.ropes);
  expect(errors.filter((e) => !/favicon|WebGL|swiftshader|GPU stall|Failed to load resource/i.test(e))).toEqual([]);
});

test("kopiëren en plakken, ongedaan maken en opnieuw: de anchors blijven bewaard", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "toetsenbord: desktop volstaat");
  await openEditor(page);
  const { left, middle } = await placeTwoPoles(page);
  await page.getByTestId("knop-touw").click();
  await drag(page, left, middle);
  const draft = await readDraft(page, (d) => (d.ropes?.length ?? 0) === 1);
  await page.keyboard.press("Escape");

  await page.mouse.click(left.x, left.y);
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  const pasted = await readDraft(page, (d) => d.items.length === 4 && (d.ropes?.length ?? 0) === 2);
  const copy = pasted.ropes!.find((r) => r.id !== draft.ropes![0].id)!;
  expect(copy.a.anchor).toBe("paal_top");
  onPole(copy.a);
  expect(copy.b.anchor).toBe("paal_top");

  await page.keyboard.press("Control+z");
  await readDraft(page, (d) => d.items.length === 2 && (d.ropes?.length ?? 0) === 1);
  await page.keyboard.press("Control+Shift+z");
  const redone = await readDraft(page, (d) => d.items.length === 4 && (d.ropes?.length ?? 0) === 2);
  expect(redone.ropes!.every((r) => r.a.anchor === "paal_top" && r.b.anchor === "paal_top")).toBe(true);
});

test("een oud touw (alleen local, op de korfrand) wordt bij het laden naar de paal gemigreerd", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "één keer volstaat");
  await openEditor(page);
  await placeTwoPoles(page);
  const draft = await readDraft(page, (d) => d.items.length === 2);
  const [a, b] = draft.items;
  const legacy = { ...draft, ropes: [{ id: "oud-touw-1", a: { item: a.id, local: [0.5, 2.45, 0.1] }, b: { item: b.id, local: [0.45, 2.4, -0.1] } }] };
  const warnings: string[] = [];
  page.on("console", (message) => message.type() === "warning" && warnings.push(message.text()));
  await page.evaluate((payload) => window.localStorage.setItem("gymwiki.floorplan3d.draft.nieuw", JSON.stringify(payload)), legacy);
  await page.reload({ waitUntil: "load" });
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Herstellen" }).click();
  await page.waitForTimeout(1500);
  // De verschuiving van de korfrand naar de paal is groter dan de tolerantie: de editor meldt dat in de console.
  expect(warnings.some((w) => /\[anchors\].*touw oud-touw.*"paal_top"/.test(w)), warnings.join(" | ")).toBe(true);
});
