import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { openEditor, placeFromLibrary, readDraft } from "./helpers";

// JSON-export en -import in de editor (testroute met placeholder-modellen), desktop + iPhone 14 + Pixel 7.
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop + telefoons volstaan");
});

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 640;

async function placeMat(page: Page) {
  if (isPhone(page)) await placeFromLibrary(page, /^Matten/, /Testmat groot toevoegen/);
  else {
    await page.getByRole("button", { name: /^Matten/ }).first().click();
    await page.getByRole("button", { name: /Testmat groot toevoegen/ }).click();
  }
  await readDraft(page, (d) => d.items.length >= 1);
}

async function jsonAction(page: Page, name: RegExp) {
  if (isPhone(page)) {
    await page.getByRole("button", { name: "Meer acties" }).click();
    await page.getByRole("menuitem", { name }).click();
  } else {
    await page.getByRole("button", { name: /JSON: downloaden/ }).click();
    await page.getByRole("menuitem", { name }).click();
  }
}

const scene = (items: object[], coneFields: object[] = []) => ({ version: 1, room: { width_m: 24, length_m: 14 }, items, coneFields });
const envelope = (s: object, over: object = {}) => ({ format: "gymwiki-plattegrond", version: 1, exportedAt: "2026-10-28T10:00:00.000Z", title: "Importtest", scene: s, ...over });
const item = (id: string, slug: string, x = 0, z = 0) => ({ id, slug, x, y: 0, z, rot_y_deg: 0 });

async function importText(page: Page, text: string, name = "test.json") {
  await page.getByTestId("json-file-input").setInputFiles({ name, mimeType: "application/json", buffer: Buffer.from(text) });
}

test("downloaden levert een geldig bestand met envelope en scene", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openEditor(page);
  await placeMat(page);
  const download = page.waitForEvent("download");
  await jsonAction(page, /JSON downloaden/);
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^plattegrond-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.json$/);
  const text = readFileSync((await file.path())!, "utf8");
  const parsed = JSON.parse(text);
  expect(parsed.format).toBe("gymwiki-plattegrond");
  expect(parsed.version).toBe(1);
  expect(Number.isNaN(Date.parse(parsed.exportedAt))).toBe(false);
  expect(parsed.scene.items[0].slug).toBe("testmat_groot");
  expect(Object.keys(parsed.scene)).toEqual(["version", "room", "items", "coneFields"]);
  expect(text).not.toMatch(/user_id|activiteit|token/);
  expect(text).toContain('\n  "scene": {');
  expect(errors).toEqual([]);
});

test("kopiëren zet dezelfde JSON op het klembord", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "klembordrechten alleen desktop");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openEditor(page);
  await placeMat(page);
  await jsonAction(page, /JSON kopiëren/);
  await expect(page.getByText("JSON gekopieerd naar het klembord.")).toBeVisible();
  const parsed = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  expect(parsed.scene.items).toHaveLength(1);
});

test("openen in een lege editor laadt direct; roundtrip behoudt de scene", async ({ page }) => {
  await openEditor(page);
  await importText(page, JSON.stringify(envelope(scene([item("a", "testmat_groot", -2, 1), item("b", "basketbal_test", 3, -1)]))));
  const draft = await readDraft(page, (d) => d.items.length === 2);
  expect(draft.items.map((i) => i.slug).sort()).toEqual(["basketbal_test", "testmat_groot"]);
  await expect(page.getByTestId("json-import-dialog")).toHaveCount(0);
});

test("vervangen vraagt bevestiging en is met één undo terug te draaien", async ({ page }, testInfo) => {
  await openEditor(page);
  await placeMat(page);
  await importText(page, JSON.stringify(envelope(scene([item("x", "basketbal_test"), item("y", "voetbal_test", 2, 2)]))));
  const dialog = page.getByTestId("json-import-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Huidige plattegrond vervangen?" })).toBeVisible();
  await dialog.getByRole("button", { name: "Annuleren" }).click();
  await expect(dialog).toHaveCount(0);
  expect((await readDraft(page)).items).toHaveLength(1);

  await importText(page, JSON.stringify(envelope(scene([item("x", "basketbal_test"), item("y", "voetbal_test", 2, 2)]))));
  await page.getByTestId("json-import-confirm").click();
  await readDraft(page, (d) => d.items.length === 2 && d.items.every((i) => i.slug !== "testmat_groot"));
  if (testInfo.project.name === "desktop") {
    await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => undefined);
    await page.keyboard.press("Control+z");
    await readDraft(page, (d) => d.items.length === 1 && d.items[0].slug === "testmat_groot");
  }
  // Op telefoon staat undo niet in beeld; de ene undo-stap is op desktop gecontroleerd.
});

test("onbekende items geven een waarschuwing; de rest wordt geladen", async ({ page }) => {
  await openEditor(page);
  await importText(page, JSON.stringify(envelope(scene([item("a", "testmat_groot"), item("b", "bestaat_niet_1"), item("c", "bestaat_niet_2")]))));
  const dialog = page.getByTestId("json-import-dialog");
  await expect(dialog.getByText(/bestaat_niet_1, bestaat_niet_2/)).toBeVisible();
  await dialog.getByRole("button", { name: "Annuleren" }).click();
  expect((await page.evaluate(() => window.localStorage.getItem("gymwiki.floorplan3d.draft.nieuw"))) ?? "").toBe("");
  await importText(page, JSON.stringify(envelope(scene([item("a", "testmat_groot"), item("b", "bestaat_niet_1")]))));
  await page.getByTestId("json-import-confirm").click();
  const draft = await readDraft(page, (d) => d.items.length === 1);
  expect(draft.items[0].slug).toBe("testmat_groot");
});

test("foute bestanden tonen een Nederlandse melding met pad en reden", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openEditor(page);
  const dialog = page.getByTestId("json-import-dialog");

  await importText(page, "{ geen json");
  await expect(dialog.getByText(/geen geldige JSON/)).toBeVisible();
  await dialog.getByRole("button", { name: "Sluiten" }).first().click();

  const bad = envelope(scene([{ ...item("a", "testmat_groot"), x: "links" }]));
  await importText(page, JSON.stringify(bad));
  await expect(dialog.getByText("scene.items[0].x")).toBeVisible();
  await expect(dialog.getByText(/moet een getal zijn/)).toBeVisible();
  await dialog.getByRole("button", { name: "Sluiten" }).first().click();

  await importText(page, JSON.stringify(envelope(scene([]), { version: 99 })));
  await expect(dialog.getByText(/nieuwere|begrijpt tot en met versie 1/)).toBeVisible();
  await dialog.getByRole("button", { name: "Sluiten" }).first().click();
  expect(errors).toEqual([]);
});

test("een bestand slepen op de editor opent het", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "slepen alleen desktop");
  await openEditor(page);
  const text = JSON.stringify(envelope(scene([item("a", "testmat_groot")])));
  const dataTransfer = await page.evaluateHandle((content) => {
    const dt = new DataTransfer();
    dt.items.add(new File([content], "sleep.json", { type: "application/json" }));
    return dt;
  }, text);
  const root = page.locator("div.relative.h-\\[100dvh\\]").first();
  await root.dispatchEvent("dragenter", { dataTransfer });
  await expect(page.getByTestId("json-drop-overlay")).toBeVisible();
  await root.dispatchEvent("drop", { dataTransfer });
  await readDraft(page, (d) => d.items.length === 1);
});
