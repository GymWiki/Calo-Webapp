import { expect, test, type Page } from "@playwright/test";

import { canvasCenter, openEditor, placeFromLibrary, readDraft, touchDrag, type DraftRope } from "./helpers";

// Eindpunten van touwen verslepen (naar een ander object, naar een vrij punt op de vloer), annuleren, en het hele touw verplaatsen.
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

async function placeTwoMats(page: Page) {
  const { x, y } = await canvasCenter(page);
  const left = { x: x - (isDesktop(page) ? 230 : 150), y };
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

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  if (isDesktop(page)) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 14 });
    await page.mouse.up();
  } else {
    await touchDrag(page, from, to, 14);
  }
}

/** Twee matten met een touw ertussen, touw geselecteerd (handvatten zichtbaar). */
async function ropeSelected(page: Page) {
  await openEditor(page);
  const { left, middle } = await placeTwoMats(page);
  await (isDesktop(page) ? page.getByTestId("knop-touw") : page.getByTestId("toolbar-touw")).click();
  await drag(page, left, middle);
  const draft = await readDraft(page, (d) => (d.ropes?.length ?? 0) === 1);
  await (isDesktop(page) ? page.keyboard.press("Escape") : page.getByTestId("toolbar-touw").click());
  let hit = { x: (left.x + middle.x) / 2, y: left.y };
  // Selecteer het touw: tik op het midden van de lijn (het touw hangt boven/tussen de matten; probeer enkele punten).
  search: for (const dy of [0, -8, 8, -16, -24, 16]) {
    for (let step = 3; step <= 9; step++) {
      const point = { x: left.x + ((middle.x - left.x) * step) / 12, y: left.y + dy };
      if (isDesktop(page)) await page.mouse.click(point.x, point.y);
      else await page.touchscreen.tap(point.x, point.y);
      if (await page.getByTestId("touw-paneel").isVisible().catch(() => false)) {
        hit = point;
        break search;
      }
    }
  }
  return { left, middle, draft, hit };
}

const rope = (d: { ropes?: DraftRope[] }) => d.ropes![0];
const endWorldPoint = (end: DraftRope["a"]) => ("free" in end ? (end as unknown as { free: number[] }).free : null);

test("eindpunt naar een vrij punt op de vloer slepen: het blijft staan (ook na herladen), geen terugspringen, één undo-stap", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "muis; telefoon: zie het mobiele scenario");
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const { middle, draft } = await ropeSelected(page);
  await expect(page.getByTestId("touw-paneel")).toBeVisible();
  const before = rope(draft);

  // Pak het uiteinde op de rechter mat en laat het los op een leeg stuk vloer (rechtsonder).
  const target = { x: middle.x + 150, y: middle.y + 110 };
  await drag(page, { x: middle.x, y: middle.y - 6 }, target);
  const after = await readDraft(page, (d) => rope(d).b !== undefined && "free" in rope(d).b);
  const free = endWorldPoint(rope(after).b)!;
  expect(free).toHaveLength(3);
  // Het andere uiteinde blijft precies zoals het was; het verslepen uiteinde is nu een vrij punt (raster van 25 cm).
  expect(rope(after).a).toEqual(before.a);
  expect(Math.abs(free[0] / 0.25 - Math.round(free[0] / 0.25))).toBeLessThan(1e-6);
  expect(Math.abs(free[2] / 0.25 - Math.round(free[2] / 0.25))).toBeLessThan(1e-6);

  // Niet terug laten springen: nog even wachten (autosave/renders) en opnieuw lezen.
  await page.waitForTimeout(1200);
  expect(rope(await readDraft(page)).b).toEqual(rope(after).b);

  // Eén undo-stap zet het uiteinde terug naar het object.
  await page.keyboard.press("Control+z");
  const undone = await readDraft(page, (d) => rope(d).b !== undefined && !("free" in rope(d).b));
  expect(rope(undone).b).toEqual(before.b);
  await page.keyboard.press("Control+Shift+z");
  await readDraft(page, (d) => "free" in rope(d).b);

  // Herladen en de kladversie herstellen: hetzelfde vrije punt.
  await page.reload({ waitUntil: "load" });
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Herstellen" }).click();
  await page.waitForTimeout(1200);
  const reloaded = await readDraft(page, (d) => (d.ropes?.length ?? 0) === 1);
  expect(rope(reloaded).b).toEqual(rope(after).b);
  expect(errors.filter((e) => !/favicon|WebGL|swiftshader|GPU stall|Failed to load resource/i.test(e))).toEqual([]);
});

test("Escape tijdens het slepen annuleert zonder wijziging", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "toetsenbord");
  const { middle, draft } = await ropeSelected(page);
  const before = JSON.stringify(rope(draft));
  await page.mouse.move(middle.x, middle.y - 6);
  await page.mouse.down();
  await page.mouse.move(middle.x + 120, middle.y + 90, { steps: 10 });
  await expect(page.getByTestId("touw-lengte")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForTimeout(800);
  await expect(page.getByTestId("touw-lengte")).toHaveCount(0);
  expect(JSON.stringify(rope(await readDraft(page)))).toBe(before);
});

type Item = { id: string; x: number; y: number; z: number };
const worldOf = (end: DraftRope["a"], items: Item[]): number[] => {
  const free = endWorldPoint(end);
  if (free) return free;
  const anchored = end as unknown as { item: string; local: number[] };
  const item = items.find((candidate) => candidate.id === anchored.item)!;
  return [item.x + anchored.local[0], item.y + anchored.local[1], item.z + anchored.local[2]];
};
const length = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test("het hele touw verslepen: lengte blijft gelijk, de koppeling met de objecten wordt verbroken (met melding), één undo-stap", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop en telefoon volstaan");
  const { hit, draft } = await ropeSelected(page);
  await expect(page.getByTestId("touw-paneel").or(page.getByTestId("touw-hud"))).toBeVisible();
  if (!isDesktop(page)) await page.getByTestId("touw-modus-geheel").click();
  const items = draft.items as Item[];
  const lengthBefore = length(worldOf(rope(draft).a, items), worldOf(rope(draft).b, items));

  // Sleep aan het touw zelf (een echte sleepbeweging van enkele meters) naar beneden naar een leeg stuk vloer.
  await drag(page, hit, { x: hit.x + 20, y: hit.y + 70 });
  const moved = await readDraft(page, (d) => "free" in rope(d).a && "free" in rope(d).b);
  const lengthAfter = length(worldOf(rope(moved).a, items), worldOf(rope(moved).b, items));
  expect(Math.abs(lengthAfter - lengthBefore)).toBeLessThan(0.02);
  // Beide uiteinden liggen op het 25 cm-raster of zijn aan de verschuiving gekoppeld; het touw is niet meer aan de matten gekoppeld.
  await expect(page.getByText("Touw losgemaakt van de objecten")).toBeVisible();

  // Eén undo-stap: terug aan de matten.
  await page.keyboard.press(isDesktop(page) ? "Control+z" : "Escape").catch(() => undefined);
  if (isDesktop(page)) {
    const undone = await readDraft(page, (d) => !("free" in rope(d).a) && !("free" in rope(d).b));
    expect(rope(undone)).toEqual(rope(draft));
  }
});
