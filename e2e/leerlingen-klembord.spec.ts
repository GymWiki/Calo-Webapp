import { expect, test, type Page } from "@playwright/test";

import { canvasCenter, expectNoHorizontalOverflow, readDraft, type DraftItem } from "./helpers";

// Leerling als plaatsbaar item (pose, kleur, grootte) en kopiëren/plakken van alle objecten — via de gratis tool met de
// testcatalogus (gekleurde dozen op de echte leerlingmaten, geen GLB's of Supabase nodig).
const PATH = "/gratis-gymzaal-plattegrond-maken";
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 640;
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

async function start(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("gymwiki.editor.onboarding.v1", "1");
    } catch {
      // geen localStorage
    }
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(style);
    });
  });
  await page.goto(PATH);
  await page.getByTestId("start-editor").click();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1500);
}

/** Bibliotheek → Personen → het ene Leerling-kaartje. Op een telefoon opent daarna vanzelf het itempaneel. */
async function placeStudent(page: Page) {
  if (!isDesktop(page)) await page.getByTestId("toolbar-bibliotheek").click();
  await page.getByRole("button", { name: /^Personen/ }).first().click();
  await page.getByRole("button", { name: /^Leerling$|Leerling toevoegen/ }).first().click();
  await expect(page.getByTestId("student-panel")).toBeVisible();
}

/** Een categorie in de bibliotheek is een open/dicht-knop: alleen openen als het item nog niet zichtbaar is. */
async function placeMat(page: Page) {
  if (!isDesktop(page)) await page.getByTestId("toolbar-bibliotheek").click();
  const mat = page.getByRole("button", { name: /Testmat groot toevoegen/ });
  if (!(await mat.isVisible())) {
    // Na een bezoek aan het tabblad Personen staat de bibliotheek nog op Personen.
    const materiaal = page.getByRole("button", { name: /^Materiaal$/ });
    if (await materiaal.isVisible()) await materiaal.click();
    // De categorie kan nog openstaan van de vorige keer.
    if (!(await mat.isVisible())) await page.getByRole("button", { name: /^Matten/ }).first().click();
  }
  await mat.click();
}

test("bibliotheek toont één Leerling-kaartje, geen 19 losse poses", async ({ page }) => {
  await start(page);
  if (!isDesktop(page)) await page.getByTestId("toolbar-bibliotheek").click();
  await page.getByRole("button", { name: /^Personen/ }).first().click();
  await expect(page.getByRole("button", { name: /^Personen \(1\)/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Leerling toevoegen|^Leerling$/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Leerling – /i })).toHaveCount(0);
});

test("leerling plaatsen, pose/kleur/grootte kiezen, sluiten en heropenen geeft dezelfde stand", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  await placeStudent(page);
  const placed = await readDraft(page, (d) => d.items.length === 1);
  expect(placed.items[0].slug).toBe("leerling_pose_standaard");
  expect(placed.items[0].color).toBeUndefined();

  await expect(page.getByTestId("pose-standaard")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("pose-standaard-badge")).toBeVisible();
  // De standaard leerling is de eerste kaart in het poseraster.
  expect(await page.locator("[data-testid^=pose-]:not([data-testid$=badge])").first().getAttribute("data-testid")).toBe("pose-standaard");
  await page.getByTestId("pose-hockey").click();
  await page.getByTestId("kleur-rood").click();
  await page.getByTestId("grootte-groot").click();
  const edited = await readDraft(page, (d) => d.items[0].slug === "leerling_pose_hockey" && d.items[0].color === "#dc2626" && d.items[0].size === "groot");
  expect(edited.items).toHaveLength(1);
  expect(edited.items[0].id).toBe(placed.items[0].id);
  expect(edited.items[0].x).toBe(placed.items[0].x);

  // Middel is de standaard en wordt dan niet opgeslagen; de standaardkleur haalt de kleur weer weg.
  await page.getByTestId("grootte-middel").click();
  await page.getByTestId("kleur-standaard").click();
  await readDraft(page, (d) => d.items[0].size === undefined && d.items[0].color === undefined);

  // Sportfilter en zoekbalk.
  await page.getByRole("group", { name: "Filter op sport" }).getByRole("button", { name: "Basketbal" }).click();
  await expect(page.getByTestId("pose-basketbal_dribbelen")).toBeVisible();
  await expect(page.getByTestId("pose-hockey")).toHaveCount(0);
  await page.getByRole("group", { name: "Filter op sport" }).getByRole("button", { name: "Alle" }).click();
  await page.getByLabel("Zoek pose").fill("volleybal");
  await expect(page.getByTestId("pose-volleybal_bovenhands")).toBeVisible();
  await expect(page.getByTestId("pose-hockey")).toHaveCount(0);
  await page.getByLabel("Zoek pose").fill("");

  await page.getByTestId("kleur-blauw").click();
  await page.getByTestId("pose-hardlopen").click();
  await readDraft(page, (d) => d.items[0].slug === "leerling_pose_hardlopen" && d.items[0].color === "#2563eb");
  // Terug naar de standaard leerling: de kleur blijft staan.
  await page.getByTestId("pose-standaard").click();
  await readDraft(page, (d) => d.items[0].slug === "leerling_pose_standaard" && d.items[0].color === "#2563eb");
  await page.getByTestId("pose-juichen").click();
  await readDraft(page, (d) => d.items[0].slug === "leerling_pose_juichen" && d.items[0].color === "#2563eb");

  if (isPhone(page)) {
    // De kaartjes zijn minstens 44 px hoog en de pagina scrolt niet zijwaarts.
    const box = await page.getByTestId("pose-hockey").boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalOverflow(page);
  }

  await page.keyboard.press("Escape");
  if (isDesktop(page)) await page.getByRole("button", { name: /Sluiten/ }).first().click();
  else await page.getByRole("button", { name: "Editor sluiten" }).click();
  await expect(page.getByTestId("gast-editor")).toHaveCount(0);
  await page.getByTestId("start-editor").click();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  const restored = await readDraft(page, (d) => d.items.length === 1);
  expect(restored.items[0]).toMatchObject({ slug: "leerling_pose_juichen", color: "#2563eb" });
  expect(errors).toEqual([]);
});

test.describe("kopiëren en plakken (desktop)", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "sneltoetsen: alleen desktop");
  });

  async function focusCanvasArea(page: Page) {
    await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => undefined);
  }

  test("Ctrl+C / Ctrl+V op één object: kopie met nieuw id en alle eigenschappen, één undo-stap", async ({ page }) => {
    await start(page);
    await placeStudent(page);
    await page.getByTestId("pose-verdedigen").click();
    await page.getByTestId("kleur-geel").click();
    await page.getByTestId("grootte-klein").click();
    await readDraft(page, (d) => d.items[0].color === "#facc15" && d.items[0].size === "klein");
    await focusCanvasArea(page);
    await page.keyboard.press("Control+c");
    await expect(page.getByText("1 object gekopieerd")).toBeVisible();
    await page.keyboard.press("Control+v");
    const pasted = await readDraft(page, (d) => d.items.length === 2);
    const [original, copy] = pasted.items;
    expect(copy.id).not.toBe(original.id);
    expect(copy).toMatchObject({ slug: original.slug, color: original.color, size: original.size, rot_y_deg: original.rot_y_deg });
    expect(Math.hypot(copy.x - original.x, copy.z - original.z)).toBeGreaterThan(0.2);
    // Nog een keer plakken schuift verder op.
    await page.keyboard.press("Control+v");
    const again = await readDraft(page, (d) => d.items.length === 3);
    expect(new Set(again.items.map((item) => `${item.x.toFixed(2)},${item.z.toFixed(2)}`)).size).toBe(3);
    // Eén plak = één undo-stap.
    await page.keyboard.press("Control+z");
    await readDraft(page, (d) => d.items.length === 2);
    await page.keyboard.press("Control+z");
    await readDraft(page, (d) => d.items.length === 1);
  });

  test("Ctrl+A selecteert alles; Ctrl+C/Ctrl+V plakt de hele groep met gelijke onderlinge afstanden", async ({ page }) => {
    await start(page);
    await placeMat(page);
    await placeStudent(page);
    await placeMat(page);
    const before = await readDraft(page, (d) => d.items.length === 3);
    await focusCanvasArea(page);
    await page.keyboard.press("Control+a");
    await expect(page.getByTestId("groep-paneel")).toContainText("3 objecten geselecteerd");
    await page.keyboard.press("Control+c");
    await expect(page.getByText("3 objecten gekopieerd")).toBeVisible();
    await page.keyboard.press("Control+v");
    const after = await readDraft(page, (d) => d.items.length === 6);
    const originals = before.items;
    const copies = after.items.filter((item) => !originals.some((original) => original.id === item.id));
    expect(copies).toHaveLength(3);
    for (let i = 1; i < 3; i++) {
      const sameOriginal = (a: DraftItem, b: DraftItem) => [b.x - a.x, b.z - a.z];
      const [ox, oz] = sameOriginal(originals[0], originals[i]);
      const [cx, cz] = sameOriginal(copies[0], copies[i]);
      expect(cx).toBeCloseTo(ox, 2);
      expect(cz).toBeCloseTo(oz, 2);
    }
    await page.keyboard.press("Control+z");
    await readDraft(page, (d) => d.items.length === 3);
    // Delete verwijdert de hele selectie (één stap).
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Delete");
    await readDraft(page, (d) => d.items.length === 0);
    await page.keyboard.press("Control+z");
    await readDraft(page, (d) => d.items.length === 3);
  });

  test("Ctrl+X knipt, Ctrl+D dupliceert direct", async ({ page }) => {
    await start(page);
    await placeMat(page);
    await readDraft(page, (d) => d.items.length === 1);
    await focusCanvasArea(page);
    await page.keyboard.press("Control+d");
    await readDraft(page, (d) => d.items.length === 2);
    await page.keyboard.press("Control+x");
    await readDraft(page, (d) => d.items.length === 1);
    await page.keyboard.press("Control+v");
    await readDraft(page, (d) => d.items.length === 2);
  });

  test("sneltoetsen doen niets in een invoerveld", async ({ page }) => {
    await start(page);
    await placeMat(page);
    await readDraft(page, (d) => d.items.length === 1);
    const name = page.getByLabel("Zoek materiaal");
    await name.fill("mat");
    await name.press("Control+a");
    await name.press("Control+c");
    await name.press("Control+v");
    await name.press("Delete");
    await page.waitForTimeout(400);
    const draft = await readDraft(page);
    expect(draft.items).toHaveLength(1);
    await expect(page.getByText(/gekopieerd|geplakt/)).toHaveCount(0);
  });

  test("vreemde klembordtekst wordt geweigerd met een nette melding", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await start(page);
    await placeMat(page);
    await readDraft(page, (d) => d.items.length === 1);
    await focusCanvasArea(page);
    await page.evaluate(() => navigator.clipboard.writeText("dit is geen plattegrond"));
    await page.keyboard.press("Control+v");
    await expect(page.getByText("Het klembord bevat geen GymWiki-objecten.")).toBeVisible();
    const draft = await readDraft(page);
    expect(draft.items).toHaveLength(1);
  });

  test("kopiëren schrijft herkenbare JSON (gymwiki-clipboard) naar het systeemklembord", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await start(page);
    await placeMat(page);
    await readDraft(page, (d) => d.items.length === 1);
    await focusCanvasArea(page);
    await page.keyboard.press("Control+c");
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText()), { timeout: 5000 }).toContain('"format":"gymwiki-clipboard"');
  });

  test("Shift+klik voegt toe aan de selectie", async ({ page }) => {
    await start(page);
    await placeMat(page);
    await placeMat(page);
    await readDraft(page, (d) => d.items.length === 2);
    await focusCanvasArea(page);
    await page.keyboard.press("Control+a");
    await expect(page.getByTestId("groep-paneel")).toBeVisible();
    await page.getByRole("button", { name: "Selectie opheffen" }).click();
    await expect(page.getByTestId("groep-paneel")).toHaveCount(0);
  });
});

test.describe("kopiëren en plakken (mobiel)", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "alleen mobiele projecten");
  });

  test("selectiebalk: Kopiëren, Plakken en Dupliceren zonder toetsenbord", async ({ page }) => {
    await start(page);
    await placeMat(page);
    await readDraft(page, (d) => d.items.length === 1);
    const bar = page.getByRole("toolbar", { name: /Acties voor Testmat groot/ });
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("button", { name: "Plakken" })).toHaveCount(0);
    await bar.getByRole("button", { name: "Kopiëren" }).click();
    await bar.getByRole("button", { name: "Plakken" }).click();
    await readDraft(page, (d) => d.items.length === 2);
    await page.getByRole("toolbar", { name: /Acties voor Testmat groot/ }).getByRole("button", { name: "Dupliceren" }).click();
    await readDraft(page, (d) => d.items.length === 3);
    const sizes = await bar.getByRole("button").evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalOverflow(page);
    const { box } = await canvasCenter(page);
    expect(box.width).toBeGreaterThan(300);
  });
});
