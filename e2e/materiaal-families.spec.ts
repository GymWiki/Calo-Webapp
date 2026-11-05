import { expect, test, type Page } from "@playwright/test";

import { canvasCenter, openEditor, readDraft } from "./helpers";

// Materiaal-families: één kaart per familie, de maat kies je na het plaatsen in het itempaneel. Bestaande item-id's (slugs) blijven gelijk.
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

async function openLibrary(page: Page) {
  if (!isDesktop(page)) await page.getByTestId("toolbar-bibliotheek").click();
}

/** Zoek de familiekaart en plaats hem (de laatst gebruikte of standaardmaat). Op een telefoon opent daarna vanzelf het itempaneel. */
async function placeFamily(page: Page, zoek: string, kaart: RegExp) {
  await openLibrary(page);
  await page.getByRole("searchbox").fill(zoek);
  await page.getByRole("button", { name: kaart }).first().click();
  await expect(page.getByTestId("maat-paneel")).toBeVisible();
}

test("één kaart per familie met een label 'N maten'; zoeken op een maatnaam vindt de familie", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop en telefoon volstaan");
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await openEditor(page);
  await openLibrary(page);
  for (const [query, naam, maten] of [["4 delen", "Turnkast", "3 maten"], ["maat 7", "Basketbal", "2 maten"]] as const) {
    await page.getByRole("searchbox").fill(query);
    const kaart = page.getByRole("button", { name: new RegExp(`^${naam} toevoegen`) });
    await expect(kaart).toHaveCount(1);
    await expect(kaart.locator("..").getByTestId("maten-label")).toHaveText(maten);
  }
  // De losse maten staan niet meer als eigen kaart in de lijst.
  await page.getByRole("searchbox").fill("turnkast");
  await expect(page.getByRole("button", { name: /Turnkast 2 delig toevoegen|Turnkast 6 delig toevoegen/ })).toHaveCount(0);
  expect(errors.filter((e) => !/favicon|WebGL|swiftshader|GPU stall|Failed to load resource/i.test(e))).toEqual([]);
});

test("turnkast: maat wisselen met plus en min; positie en rotatie blijven; één undo-stap; opslaan en herladen behoudt de maat", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop en telefoon volstaan");
  await openEditor(page);
  await placeFamily(page, "turnkast", /^Turnkast toevoegen/);
  const placed = await readDraft(page, (d) => d.items.length === 1);
  expect(placed.items[0].slug).toBe("turnkast_4_delig");
  const before = placed.items[0];

  // De testcatalogus heeft 2, 4 en 6 delen; het echte menu heeft 1 t/m 7.
  await page.getByTestId("maat-plus").click();
  const six = await readDraft(page, (d) => d.items[0].slug === "turnkast_6_delig_1_recht");
  expect(six.items[0]).toMatchObject({ id: before.id, x: before.x, z: before.z, rot_y_deg: before.rot_y_deg, y: before.y });
  await expect(page.getByTestId("maat-huidig")).toHaveText("6 delen");
  await expect(page.getByTestId("maat-afmetingen")).toContainText("1,55");

  for (let step = 0; step < 2; step++) await page.getByTestId("maat-min").click();
  await readDraft(page, (d) => d.items[0].slug === "turnkast_2_delig");
  // 2 delen is de laagste maat met een model in de testcatalogus: de min-knop is uit.
  expect(await page.getByTestId("maat-min").isDisabled()).toBe(true);

  // Plaatsen onthoudt de laatst gebruikte maat; één undo-stap per maatwissel (desktop-sneltoets).
  if (isDesktop(page)) {
    await page.keyboard.press("Control+z");
    // Elke maatwissel is één undo-stap: van 2 delen één stap terug = 4 delen.
    await readDraft(page, (d) => d.items[0].slug === "turnkast_4_delig");
  }
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: "load" });
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Herstellen", exact: true }).click();
  await page.waitForTimeout(1200);
  const reloaded = await readDraft(page, (d) => d.items.length === 1);
  expect(reloaded.items[0].slug).toBe(isDesktop(page) ? "turnkast_4_delig" : "turnkast_2_delig");
});

test("bal (segmentkeuze): maat wisselen; een maat zonder model (maat 6) wordt niet getoond", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop en telefoon volstaan");
  await openEditor(page);
  await placeFamily(page, "basketbal", /^Basketbal toevoegen/);
  await readDraft(page, (d) => d.items.length === 1 && d.items[0].slug === "basketbal_maat_5");
  await expect(page.getByTestId("maat-maat_6")).toHaveCount(0);
  await page.getByTestId("maat-maat_7").click();
  await readDraft(page, (d) => d.items[0].slug === "basketbal_maat_7");
  await expect(page.getByTestId("maat-afmetingen")).toContainText("0,24 × 0,24 × 0,24");
});

test("meerdere items van dezelfde familie: de maat geldt voor allemaal", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "selectie met Ctrl+A: alleen desktop");
  await openEditor(page);
  await placeFamily(page, "basketbal", /^Basketbal toevoegen/);
  await readDraft(page, (d) => d.items.length === 1);
  const { x, y } = await canvasCenter(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 160, y, { steps: 8 });
  await page.mouse.up();
  await openLibrary(page);
  await page.getByRole("searchbox").fill("basketbal");
  await page.getByRole("button", { name: /^Basketbal toevoegen/ }).first().click();
  await readDraft(page, (d) => d.items.length === 2);
  await page.mouse.click(x + 400, y - 200); // lege plek: deselecteren
  await page.keyboard.press("Control+a");
  await expect(page.getByTestId("groep-paneel")).toBeVisible();
  await page.getByTestId("maat-maat_7").click();
  await readDraft(page, (d) => d.items.length === 2 && d.items.every((item) => item.slug === "basketbal_maat_7"));
});

test("kleurfamilie: dodgeball in blauw of rood kiezen (kleurbolletjes), de kaart zegt '2 kleuren'", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop en telefoon volstaan");
  await openEditor(page);
  await openLibrary(page);
  await page.getByRole("searchbox").fill("trefbal");
  const kaart = page.getByRole("button", { name: /^Dodgeball \(vinyl\) toevoegen/ });
  await expect(kaart.locator("..").getByTestId("maten-label")).toHaveText("2 kleuren");
  await kaart.click();
  await expect(page.getByTestId("maat-paneel")).toBeVisible();
  await readDraft(page, (d) => d.items.length === 1 && d.items[0].slug === "dodgeball_vinyl_blauw");
  await page.getByTestId("maat-rood").click();
  await readDraft(page, (d) => d.items[0].slug === "dodgeball_vinyl_rood");
  await expect(page.getByTestId("maat-huidig")).toHaveText("Rood");
});
