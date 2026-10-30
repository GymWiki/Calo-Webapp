import { expect, test, type Page } from "@playwright/test";

import { canvasCenter, openEditor, placeFromLibrary, readDraft, touchDrag } from "./helpers";

// Touw spannen: een rood touw tussen twee objecten. Het blijft vastzitten aan zijn punt op elk object, is geen item (stapelt niet)
// en is te selecteren, te verwijderen en ongedaan te maken. Desktop (muis) en telefoon (vinger).
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

/** Twee matten: de eerste 150 px naar links geschoven, de tweede in het midden. Geeft hun schermposities terug. */
async function placeTwoMats(page: Page) {
  const { x, y } = await canvasCenter(page);
  const left = { x: x - 150, y };
  const middle = { x, y };
  if (isDesktop(page)) {
    await page.getByRole("button", { name: /^Matten/ }).first().click();
    await page.getByRole("button", { name: /Testmat groot toevoegen/ }).click();
    await readDraft(page, (d) => d.items.length === 1);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(left.x, left.y, { steps: 10 });
    await page.mouse.up();
    await page.getByRole("button", { name: /Testmat groot toevoegen/ }).click();
  } else {
    await placeFromLibrary(page, /^Matten/, /Testmat groot toevoegen/);
    await readDraft(page, (d) => d.items.length === 1);
    await touchDrag(page, middle, left);
    await placeFromLibrary(page, /^Matten/, /Testmat groot toevoegen/);
  }
  await readDraft(page, (d) => d.items.length === 2);
  return { left, middle };
}

async function startRope(page: Page) {
  await (isDesktop(page) ? page.getByTestId("knop-touw") : page.getByTestId("toolbar-touw")).click();
  await expect(page.getByTestId("touw-hint")).toBeVisible();
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

test("een touw spannen van het ene object naar het andere, en het blijft aan zijn punt vastzitten", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop en telefoon volstaan");
  await openEditor(page);
  const { left, middle } = await placeTwoMats(page);
  const before = await readDraft(page, (d) => d.items.length === 2);

  await startRope(page);
  await drag(page, left, middle);
  const withRope = await readDraft(page, (d) => (d.ropes?.length ?? 0) === 1);
  const rope = withRope.ropes![0];
  expect(rope.a.item).not.toBe(rope.b.item);
  expect(new Set(withRope.items.map((item) => item.id))).toEqual(new Set([rope.a.item, rope.b.item]));
  // Een touw is geen item: de hoogtes van de matten blijven gelijk (niets stapelt erop of eronder).
  expect(withRope.items.map((item) => item.y)).toEqual(before.items.map((item) => item.y));
  expect(withRope.items).toHaveLength(2);

  // Een object verschuiven: het touw gaat mee (zijn punt op het object blijft hetzelfde).
  await (isDesktop(page) ? page.keyboard.press("Escape") : page.getByTestId("toolbar-touw").click());
  await expect(page.getByTestId("touw-hint")).toBeHidden();
  // Touch: een niet-geselecteerd object draait de camera; eerst tikken om te selecteren, dan slepen.
  if (!isDesktop(page)) await page.touchscreen.tap(left.x, left.y);
  await drag(page, left, { x: left.x, y: left.y + 70 });
  const moved = await readDraft(page, (d) => d.items.some((item) => Math.hypot(item.x - before.items.find((b) => b.id === item.id)!.x, item.z - before.items.find((b) => b.id === item.id)!.z) > 0.15));
  expect(moved.ropes).toHaveLength(1);
  expect(moved.ropes![0].a.local).toEqual(rope.a.local);
  expect(moved.ropes![0].b.local).toEqual(rope.b.local);
});

test("loslaten op de lege vloer maakt geen touw; een touw selecteren en verwijderen is ongedaan te maken", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "muis volstaat");
  await openEditor(page);
  const { left, middle } = await placeTwoMats(page);

  await startRope(page);
  await drag(page, left, { x: left.x, y: left.y + 160 });
  await page.waitForTimeout(800);
  expect(((await readDraft(page)).ropes ?? []).length).toBe(0);

  await drag(page, left, middle);
  await readDraft(page, (d) => (d.ropes?.length ?? 0) === 1);
  await page.keyboard.press("Escape");

  // Klik op het touw. Waar precies hangt af van de camera en de doorhang (en het midden ligt vaak op een mat, die dichterbij is): probeer
  // een rij punten langs de lijn tussen de twee uiteinden tot het touw geraakt wordt.
  search: for (const dy of [0, 8, -8]) {
    for (let step = 1; step <= 11; step++) {
      await page.mouse.click(left.x + ((middle.x - left.x) * step) / 12, left.y + dy);
      if (await page.getByTestId("touw-paneel").isVisible()) break search;
    }
  }
  await expect(page.getByTestId("touw-paneel")).toBeVisible();
  await page.getByTestId("touw-verwijderen").click();
  await readDraft(page, (d) => (d.ropes?.length ?? 0) === 0);
  await page.keyboard.press("Control+z");
  await readDraft(page, (d) => (d.ropes?.length ?? 0) === 1);
});

test("een object verwijderen haalt zijn touwen weg", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "muis volstaat");
  await openEditor(page);
  const { left, middle } = await placeTwoMats(page);
  await startRope(page);
  await drag(page, left, middle);
  await readDraft(page, (d) => (d.ropes?.length ?? 0) === 1);
  await page.keyboard.press("Escape");
  await page.mouse.click(left.x, left.y);
  await page.keyboard.press("Delete");
  const after = await readDraft(page, (d) => d.items.length === 1);
  expect(after.ropes ?? []).toHaveLength(0);
});
