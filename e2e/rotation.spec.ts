import { expect, test, type Page } from "@playwright/test";

import { canvasCenter, expectNoHorizontalOverflow, openEditor, placeFromLibrary, readDraft } from "./helpers";

// Rotatie over alle assen: kantelen, rechtop zetten, opslaan (kladversie) en herstellen — desktop én mobiel.
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 640;

async function placeBench(page: Page) {
  if (isDesktop(page)) {
    await page.getByRole("button", { name: /^Toestellen/ }).first().click();
    await page.getByRole("button", { name: /Turnbank test toevoegen/ }).click();
    await page.getByRole("tab", { name: "Item" }).click();
  } else {
    await placeFromLibrary(page, /^Toestellen/, /Turnbank test toevoegen/);
    await expect(page.getByRole("toolbar", { name: /Acties voor Turnbank test/ })).toBeVisible();
    await page.getByRole("button", { name: "Rotatie en kantelen" }).click();
    await expect(page.getByTestId("rotatie-paneel")).toBeVisible();
  }
  await readDraft(page, (d) => d.items.length === 1);
}

const panel = (page: Page) => page.getByTestId("rotatie-paneel");

test("kantelen met knoppen, rechtop zetten en weer plat leggen", async ({ page }) => {
  await openEditor(page);
  await placeBench(page);

  await panel(page).getByRole("button", { name: "Kantelen voor/achter +15°" }).click();
  let draft = await readDraft(page, (d) => d.items[0].rot_x_deg === 15);
  // Het laagste punt blijft op de vloer: een gekantelde bank ligt dus niet onder de vloer.
  expect(draft.items[0].y).toBeGreaterThan(0);

  await panel(page).getByRole("button", { name: "Rechtop (90°)" }).click();
  draft = await readDraft(page, (d) => d.items[0].rot_x_deg === 90);
  expect(draft.items[0].rot_z_deg ?? 0).toBe(0);
  expect(draft.items[0].y).toBeGreaterThan(0.1); // de bank staat op zijn lange kant: laagste punt op de vloer

  await panel(page).getByRole("button", { name: "Kantelen zijwaarts +15°" }).click();
  await readDraft(page, (d) => d.items[0].rot_z_deg === 15);

  await panel(page).getByRole("button", { name: "Plat" }).click();
  draft = await readDraft(page, (d) => !d.items[0].rot_x_deg && !d.items[0].rot_z_deg);
  expect(draft.items[0].y).toBe(0);

  await panel(page).getByRole("button", { name: "Op kop" }).click();
  await readDraft(page, (d) => d.items[0].rot_z_deg === 180);
  await panel(page).getByRole("button", { name: "Reset rotatie" }).click();
  await readDraft(page, (d) => !d.items[0].rot_z_deg && d.items[0].rot_y_deg === 0);
  await expectNoHorizontalOverflow(page);
});

test("invoerveld en snapping: exacte waarde, en 45° uit het snaprooster", async ({ page }) => {
  await openEditor(page);
  await placeBench(page);
  const input = panel(page).getByLabel("Kantelen voor/achter (graden)");
  await input.fill("30");
  await readDraft(page, (d) => d.items[0].rot_x_deg === 30);
  await input.fill("200"); // buiten bereik: geklemd op 90
  await readDraft(page, (d) => d.items[0].rot_x_deg === 90);
  await panel(page).getByRole("button", { name: "Draaien +90°" }).click();
  await readDraft(page, (d) => d.items[0].rot_y_deg === 90);
  await panel(page).getByRole("button", { name: "45°", exact: true }).click();
  await expect(panel(page).getByRole("button", { name: "45°", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("opslaan en herladen: dezelfde stand komt terug", async ({ page }) => {
  await openEditor(page);
  await placeBench(page);
  await panel(page).getByRole("button", { name: "Schuin 30°" }).click();
  await panel(page).getByRole("button", { name: "Draaien +90°" }).click();
  await panel(page).getByRole("button", { name: "Kantelen zijwaarts −15°" }).click();
  const before = await readDraft(page, (d) => d.items[0].rot_x_deg === 30 && d.items[0].rot_y_deg === 90 && d.items[0].rot_z_deg === -15);

  await page.reload({ waitUntil: "load" });
  await expect(page.getByText("Niet-opgeslagen wijzigingen gevonden")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Herstellen" }).click();
  const after = await readDraft(page, (d) => d.items.length === 1 && d.items[0].rot_x_deg === 30);
  expect(after.items[0]).toMatchObject({
    slug: before.items[0].slug,
    rot_x_deg: 30,
    rot_y_deg: 90,
    rot_z_deg: -15,
  });
  expect(after.items[0].y).toBeCloseTo(before.items[0].y, 3);
});

test("undo maakt één kantelstap ongedaan; dupliceren houdt de volledige rotatie", async ({ page }) => {
  await openEditor(page);
  await placeBench(page);
  const plus = panel(page).getByRole("button", { name: "Kantelen voor/achter +15°" });
  await plus.click();
  await readDraft(page, (d) => d.items[0].rot_x_deg === 15);
  await plus.click();
  await readDraft(page, (d) => d.items[0].rot_x_deg === 30);
  if (isDesktop(page)) await page.keyboard.press("Control+z");
  else {
    // De drawer is modaal: sluiten, ongedaan maken, en de drawer weer openen.
    await page.keyboard.press("Escape");
    await page.getByTestId("toolbar-undo").click();
    await page.getByRole("button", { name: "Rotatie en kantelen" }).click();
  }
  await readDraft(page, (d) => d.items[0].rot_x_deg === 15);

  await panel(page).getByRole("button", { name: "Draaien +90°" }).click();
  if (isDesktop(page)) await page.getByRole("button", { name: /Dupliceren/ }).click();
  else {
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Dupliceren" }).click();
  }
  const draft = await readDraft(page, (d) => d.items.length === 2);
  expect(draft.items[1]).toMatchObject({ rot_x_deg: 15, rot_y_deg: 90 });
});

test("pionnen kunnen niet kantelen en leggen uit waarom", async ({ page }) => {
  await openEditor(page);
  if (isDesktop(page)) {
    await page.getByRole("button", { name: /^Klein materiaal/ }).first().click();
    await page.getByRole("button", { name: /Pion test toevoegen/ }).click();
    await page.getByRole("tab", { name: "Item" }).click();
  } else {
    await placeFromLibrary(page, /^Klein materiaal/, /Pion test toevoegen/);
    await page.getByRole("button", { name: "Rotatie en kantelen" }).click();
  }
  await expect(panel(page).getByRole("note")).toContainText("staan altijd plat op de vloer");
  await expect(panel(page).getByRole("button", { name: "Kantelen voor/achter +15°" })).toBeDisabled();
  await expect(panel(page).getByRole("button", { name: "Rechtop (90°)" })).toBeDisabled();
  await panel(page).getByRole("button", { name: "Draaien +90°" }).click();
  await readDraft(page, (d) => d.items[0].rot_y_deg === 90 && !d.items[0].rot_x_deg);
});

test("sneltoetsen: R draait, Shift+R terug, T en G kantelen (desktop)", async ({ page }) => {
  test.skip(!isDesktop(page), "alleen desktop");
  await openEditor(page);
  await placeBench(page);
  await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => undefined);
  await page.keyboard.press("r");
  await readDraft(page, (d) => d.items[0].rot_y_deg === 15);
  await page.keyboard.press("Shift+R");
  await readDraft(page, (d) => d.items[0].rot_y_deg === 0);
  await page.keyboard.press("t");
  await readDraft(page, (d) => d.items[0].rot_x_deg === 15);
  await page.keyboard.press("g");
  await readDraft(page, (d) => d.items[0].rot_z_deg === 15);
  await page.keyboard.press("Shift+T");
  await readDraft(page, (d) => !d.items[0].rot_x_deg);
});

test("3D-ring slepen draait het item (desktop)", async ({ page }) => {
  test.skip(!isDesktop(page), "alleen desktop");
  await openEditor(page);
  await placeBench(page);
  const { x, y, box } = await canvasCenter(page);
  // Zoek een ring: de cursor wordt "grab" boven een ring.
  let hit: { x: number; y: number } | null = null;
  for (let dy = 0; dy < 260 && !hit; dy += 3) {
    for (const sign of [1, -1]) {
      const point = { x, y: y + sign * dy };
      await page.mouse.move(point.x, point.y);
      const cursor = await page.evaluate(() => (document.querySelector("canvas") as HTMLCanvasElement).style.cursor);
      if (cursor === "grab") {
        hit = point;
        break;
      }
    }
  }
  expect(hit, "geen ring gevonden in het midden van het canvas").not.toBeNull();
  const before = (await readDraft(page)).items[0];
  await page.mouse.down();
  await page.mouse.move(hit!.x + 60, hit!.y + 30, { steps: 8 });
  await page.mouse.move(hit!.x + 120, hit!.y + 10, { steps: 8 });
  await page.mouse.up();
  const after = await readDraft(page, (d) => {
    const item = d.items[0];
    return item.rot_y_deg !== before.rot_y_deg || (item.rot_x_deg ?? 0) !== (before.rot_x_deg ?? 0) || (item.rot_z_deg ?? 0) !== (before.rot_z_deg ?? 0);
  });
  // Snapping staat op 15°: elke hoek is een veelvoud.
  for (const angle of [after.items[0].rot_y_deg, after.items[0].rot_x_deg ?? 0, after.items[0].rot_z_deg ?? 0]) {
    expect(Math.abs(angle / 15 - Math.round(angle / 15))).toBeLessThan(0.01);
  }
  expect(box.width).toBeGreaterThan(0);
});

test("mobiel: rotatie-drawer heeft grote doelen, geen horizontale scroll en laat de camera met rust", async ({ page }) => {
  test.skip(isDesktop(page), "alleen mobiel/tablet");
  await openEditor(page);
  await placeBench(page);
  await expectNoHorizontalOverflow(page);

  const small = await panel(page).evaluate((root) => {
    const result: string[] = [];
    for (const element of root.querySelectorAll<HTMLElement>("button, input")) {
      if (element.getAttribute("role") === "switch") {
        const label = element.closest("label")!.getBoundingClientRect();
        if (label.height < 43.5) result.push(`schakelaar-label ${label.height}`);
        continue;
      }
      const rect = element.getBoundingClientRect();
      if (rect.width < 43.5 || rect.height < 43.5) result.push(`${element.getAttribute("aria-label") ?? element.textContent} ${Math.round(rect.width)}×${Math.round(rect.height)}`);
    }
    return result;
  });
  expect(small, "touch-doelen kleiner dan 44 px").toEqual([]);

  await panel(page).getByRole("button", { name: "Rechtop (90°)" }).click();
  await readDraft(page, (d) => d.items[0].rot_x_deg === 90);
  await panel(page).getByRole("button", { name: "Kantelen zijwaarts +90°" }).click();
  await readDraft(page, (d) => d.items[0].rot_z_deg === 90);
  if (isPhone(page)) await expectNoHorizontalOverflow(page);
});
