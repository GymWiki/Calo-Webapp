import { expect, test, type Page } from "@playwright/test";

import { canvasCenter, openEditor, placeFromLibrary, readDraft, touchDrag } from "./helpers";

// Plaatsen en slepen: wat je ziet tijdens het slepen is waar het item blijft staan (geen verspringen bij loslaten),
// en een net mag over een bank — overlap geeft hooguit een waarschuwing.
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;
const NET = /Volleybalopstelling \(test\) toevoegen/;
const BANK = /Turnbank test toevoegen/;

async function add(page: Page, category: RegExp, item: RegExp) {
  if (isDesktop(page)) {
    // Een geopende categorie klapt bij nogmaals klikken dicht: alleen openen als het item nog niet zichtbaar is.
    if (!(await page.getByRole("button", { name: item }).isVisible().catch(() => false))) await page.getByRole("button", { name: category }).first().click();
    await page.getByRole("button", { name: item }).click();
  } else {
    await placeFromLibrary(page, category, item);
  }
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

test("volleybalnet over een bank plaatsen en slepen: blijft staan waar je loslaat, geen verspringen, geen console-errors", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop en telefoon volstaan");
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await openEditor(page);
  const { x, y } = await canvasCenter(page);

  await add(page, /^Toestellen/, BANK);
  await readDraft(page, (d) => d.items.length === 1);
  await add(page, /^Doelen/, NET);
  const placed = await readDraft(page, (d) => d.items.length === 2);
  const net0 = placed.items.find((item) => item.slug === "volleybal_veldopstelling_compleet_dames")!;
  const bank = placed.items.find((item) => item.slug === "turnbank_test")!;

  // Sleep het net een stuk opzij en weer over de bank; na loslaten wachten (autosave, renders) en opnieuw lezen: positie blijft gelijk.
  await drag(page, { x, y }, { x: x + 30, y: y + 40 });
  const first = await readDraft(page, (d) => {
    const net = d.items.find((item) => item.slug === "volleybal_veldopstelling_compleet_dames");
    return !!net && (Math.abs(net.x - net0.x) > 0.01 || Math.abs(net.z - net0.z) > 0.01);
  });
  await page.waitForTimeout(1200);
  const second = await readDraft(page);
  const a = first.items.find((item) => item.slug === "volleybal_veldopstelling_compleet_dames")!;
  const b = second.items.find((item) => item.slug === "volleybal_veldopstelling_compleet_dames")!;
  expect([b.x, b.y, b.z]).toEqual([a.x, a.y, a.z]);
  // Het net blijft op de vloer (op zijn eigen hoogte) en is niet op de bank getild; de bank staat er nog.
  expect(b.y).toBe(0);
  expect(second.items.find((item) => item.id === bank.id)).toBeTruthy();
  expect(errors.filter((e) => !/favicon|WebGL|swiftshader|GPU stall|Failed to load resource/i.test(e))).toEqual([]);
});

test("schakelaar Stapelen: staat standaard aan en is te bedienen (desktop: werkbalk)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "knop in de werkbalk (desktop); op telefoon een zwevende knop op het canvas");
  await openEditor(page);
  const knop = page.getByTestId("werkbalk-stapelen");
  await expect(knop).toHaveAttribute("aria-pressed", "true");
  await knop.click();
  await expect(knop).toHaveAttribute("aria-pressed", "false");
});

test("telefoon: de zwevende Stapelen-knop staat zichtbaar op het canvas (≥ 44 px) en wisselt", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop" || testInfo.project.name === "ipad", "telefoon");
  await openEditor(page);
  const knop = page.getByTestId("stapelen-schakelaar");
  const box = (await knop.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(43.5);
  expect(box.height).toBeGreaterThanOrEqual(43.5);
  await expect(knop).toHaveAttribute("aria-pressed", "true");
  await knop.tap();
  await expect(knop).toHaveAttribute("aria-pressed", "false");
});
