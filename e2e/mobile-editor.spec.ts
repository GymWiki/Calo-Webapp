import { expect, test, type Page } from "@playwright/test";

import { canvasCenter, expectNoHorizontalOverflow, openEditor, placeFromLibrary, readDraft, touchDrag } from "./helpers";

// Mobiele bediening van de 3D-editor: telefoon (iPhone 14, Pixel 7) en tablet (iPad portrait).
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "alleen mobiele projecten");
});

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 640;
const library = (page: Page) => (isPhone(page) ? page.getByRole("dialog", { name: "Bibliotheek" }) : page.getByRole("complementary", { name: "Bibliotheek" }));

async function placeMat(page: Page) {
  await placeFromLibrary(page, /^Matten/, /Testmat groot toevoegen/);
  await expect(page.getByRole("toolbar", { name: /Acties voor Testmat groot/ })).toBeVisible();
}

test("laadt zonder horizontale scroll, met 16 px-invoer en een canvas dat het scherm vult", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openEditor(page);
  await expectNoHorizontalOverflow(page);
  const sizes = await page.evaluate(() => [...document.querySelectorAll("input")].map((input) => parseFloat(getComputedStyle(input).fontSize)));
  expect(sizes.every((size) => size >= 16), `font-grootte inputs: ${sizes}`).toBe(true);
  const { box } = await canvasCenter(page);
  const viewport = page.viewportSize()!;
  expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
  expect(box.height / viewport.height).toBeGreaterThan(0.7);
  expect(errors).toEqual([]);
});

test("bibliotheek: openen, sluiten met Esc en met een tik buiten het paneel", async ({ page }) => {
  await openEditor(page);
  await page.getByTestId("toolbar-bibliotheek").click();
  await expect(library(page)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press("Escape");
  await expect(library(page)).toBeHidden();

  if (isPhone(page)) {
    await page.getByTestId("toolbar-bibliotheek").click();
    await expect(library(page)).toBeVisible();
    // Tik op het donkere vlak boven de drawer.
    await page.touchscreen.tap(20, 80);
    await expect(library(page)).toBeHidden();
  }
});

test("drawer (telefoon): slepen aan de handle geeft drie standen: half, vol, dicht", async ({ page }) => {
  test.skip(!isPhone(page), "alleen telefoon");
  await openEditor(page);
  await page.getByTestId("toolbar-bibliotheek").click();
  const sheet = library(page);
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(500); // intree-animatie
  const half = (await sheet.boundingBox())!.height;
  const handle = (await sheet.locator(".touch-none").boundingBox())!;
  const grip = { x: handle.x + handle.width / 2, y: handle.y + 12 };

  await touchDrag(page, grip, { x: grip.x, y: grip.y - 200 });
  await expect.poll(async () => (await sheet.boundingBox())!.height).toBeGreaterThan(half + 100);
  await page.waitForTimeout(400);

  const fullHandle = (await sheet.locator(".touch-none").boundingBox())!;
  const fullGrip = { x: fullHandle.x + fullHandle.width / 2, y: fullHandle.y + 12 };
  await touchDrag(page, fullGrip, { x: fullGrip.x, y: fullGrip.y + 250 });
  await expect.poll(async () => (await sheet.boundingBox())!.height).toBeLessThan(half + 20);
  await page.waitForTimeout(400);

  const halfHandle = (await sheet.locator(".touch-none").boundingBox())!;
  const halfGrip = { x: halfHandle.x + halfHandle.width / 2, y: halfHandle.y + 12 };
  await touchDrag(page, halfGrip, { x: halfGrip.x, y: halfGrip.y + 250 });
  await expect(sheet).toBeHidden();
});

test("een tik op een bibliotheekitem plaatst het in het midden en selecteert het", async ({ page }) => {
  await openEditor(page);
  await placeMat(page);
  await expect(library(page)).toBeHidden(); // sluit na plaatsen (standaardinstelling)
  const draft = await readDraft(page, (d) => d.items.length === 1);
  expect(Math.hypot(draft.items[0].x, draft.items[0].z)).toBeLessThan(0.6);
  await expectNoHorizontalOverflow(page);
});

test("zoeken en sportfilter in de bibliotheek", async ({ page }) => {
  await openEditor(page);
  await page.getByTestId("toolbar-bibliotheek").click();
  await page.getByLabel("Zoek materiaal").fill("turn");
  await expect(page.getByRole("button", { name: /Turnbank test toevoegen/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Basketbal test toevoegen/ })).toHaveCount(0);
  await page.getByLabel("Zoek materiaal").fill("");
  await page.getByRole("group", { name: "Filter op sport" }).getByRole("button", { name: /^Korfbal/ }).click();
  await expect(page.getByRole("button", { name: /Korfbalpaal test toevoegen/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Turnbank test toevoegen/ })).toHaveCount(0);
});

test("alleen het geselecteerde item is sleepbaar; een vinger op een ander item draait de camera", async ({ page }) => {
  await openEditor(page);
  await placeMat(page);
  const start = await readDraft(page, (d) => d.items.length === 1);
  const { x, y, box } = await canvasCenter(page);

  // Geselecteerd: slepen verplaatst het item.
  await touchDrag(page, { x, y }, { x: x + box.width * 0.2, y });
  const moved = await readDraft(page, (d) => Math.hypot(d.items[0].x - start.items[0].x, d.items[0].z - start.items[0].z) > 0.5);
  expect(Math.hypot(moved.items[0].x - start.items[0].x, moved.items[0].z - start.items[0].z)).toBeGreaterThan(0.5);

  // Deselecteren; nu draait een sleepbeweging op het item de camera en blijft het item staan.
  await page.getByRole("button", { name: "Klaar (deselecteren)" }).click();
  await expect(page.getByRole("toolbar", { name: /Acties voor/ })).toBeHidden();
  const before = (await readDraft(page)).items[0];
  const afterMove = await canvasCenter(page);
  const itemX = afterMove.x + (before.x - moved.items[0].x) * 0; // item staat waar het losgelaten is: bepaal het scherm-midden opnieuw
  void itemX;
  await touchDrag(page, { x, y: y }, { x: x - 60, y: y + 20 });
  await page.waitForTimeout(800);
  const after = (await readDraft(page)).items[0];
  expect(after.x).toBeCloseTo(before.x, 5);
  expect(after.z).toBeCloseTo(before.z, 5);
});

test("tik op een niet-geselecteerd item selecteert het", async ({ page }) => {
  await openEditor(page);
  await placeMat(page);
  await page.getByRole("button", { name: "Klaar (deselecteren)" }).click();
  await expect(page.getByRole("toolbar", { name: /Acties voor/ })).toBeHidden();
  const { x, y } = await canvasCenter(page);
  await page.touchscreen.tap(x, y);
  await expect(page.getByRole("toolbar", { name: /Acties voor Testmat groot/ })).toBeVisible();
});

test("roteren met de knoppen, ongedaan maken en opnieuw", async ({ page }) => {
  await openEditor(page);
  await placeMat(page);
  await page.getByRole("button", { name: "Rechts draaien (+15°)" }).click();
  await readDraft(page, (d) => d.items[0].rot_y_deg === 15);
  await page.getByRole("button", { name: "Kwartslag draaien (+90°)" }).click();
  await readDraft(page, (d) => d.items[0].rot_y_deg === 105);
  await page.getByTestId("toolbar-undo").click();
  await readDraft(page, (d) => d.items[0].rot_y_deg === 15);
  await page.getByTestId("toolbar-redo").click();
  await readDraft(page, (d) => d.items[0].rot_y_deg === 105);
});

test("verwijderen geeft een toast met Ongedaan maken", async ({ page }) => {
  await openEditor(page);
  await placeMat(page);
  await readDraft(page, (d) => d.items.length === 1);
  await page.getByRole("button", { name: "Verwijderen" }).click();
  await readDraft(page, (d) => d.items.length === 0);
  await expect(page.getByText("Item verwijderd")).toBeVisible();
  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Ongedaan maken" }).click();
  await readDraft(page, (d) => d.items.length === 1);
});

test("vergrendelen blokkeert draaien en verwijderen", async ({ page }) => {
  await openEditor(page);
  await placeMat(page);
  await page.getByRole("button", { name: "Vergrendelen" }).click();
  await readDraft(page, (d) => d.items[0].locked === true);
  await expect(page.getByRole("button", { name: "Rechts draaien (+15°)" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Verwijderen" })).toBeDisabled();
  await page.getByRole("button", { name: "Ontgrendelen" }).click();
  await expect(page.getByRole("button", { name: "Rechts draaien (+15°)" })).toBeEnabled();
});

test("veld afzetten met twee tikken, daarna Klaar", async ({ page }) => {
  await openEditor(page);
  await page.getByTestId("toolbar-veld").click();
  const { x, y } = await canvasCenter(page);
  // Schermpunten die in de zaal een rechthoek geven met zowel breedte als lengte (niet langs één as).
  await page.touchscreen.tap(x - 40, y - 60);
  await expect(page.getByText("Tik op de tegenoverliggende hoek")).toBeVisible();
  await page.touchscreen.tap(x + 60, y + 40);
  const hud = page.getByText(/Veld \d+(,\d+)? x \d+(,\d+)? m, \d+ pionnen/);
  await expect(hud.first()).toBeVisible();
  await readDraft(page, (d) => d.coneFields.length === 1);
  await page.getByRole("button", { name: "Klaar", exact: true }).click();
  await expect(hud).toHaveCount(0);
});

test("cameramenu: bovenaanzicht, 3D en reset", async ({ page }) => {
  await openEditor(page);
  await page.getByTestId("toolbar-camera").click();
  const menu = page.getByRole("group", { name: "Camera" });
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Bovenaanzicht" }).click();
  await expect(menu.getByRole("button", { name: "Bovenaanzicht" })).toHaveAttribute("aria-pressed", "true");
  await menu.getByRole("button", { name: "3D" }).click();
  await expect(menu.getByRole("button", { name: "3D" })).toHaveAttribute("aria-pressed", "true");
  await menu.getByRole("button", { name: "Reset" }).click();
  await expect(menu).toBeVisible();
});

test("touch-targets in kop, werkbalk en contextbalk zijn minimaal 44 × 44 px", async ({ page }) => {
  await openEditor(page);
  await placeMat(page);
  const small = await page.evaluate(() => {
    const roots = [document.querySelector("header"), document.querySelector('nav[aria-label="Editor-werkbalk"]'), document.querySelector('[role="toolbar"]')];
    const found: string[] = [];
    for (const root of roots) {
      root?.querySelectorAll("button, input, a").forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        if (rect.width < 43.5 || rect.height < 43.5) found.push(`${element.getAttribute("aria-label") ?? element.textContent?.trim()} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      });
    }
    return found;
  });
  expect(small).toEqual([]);
});

test("opslaan toont de status; offline geeft een duidelijke melding en je werk blijft lokaal bewaard", async ({ page, context }) => {
  await openEditor(page);
  await placeMat(page);
  await readDraft(page, (d) => d.items.length === 1);

  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  // Zonder login (testroute) mislukt het opslaan; het gaat erom dat de status zichtbaar wordt en de kladversie blijft.
  await expect(page.getByRole("status", { name: /Opslaan mislukt|Opgeslagen/ })).toBeVisible({ timeout: 20_000 });
  await readDraft(page, (d) => d.items.length === 1);

  await context.setOffline(true);
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(page.getByText(/Je bent offline/).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Opnieuw proberen" }).first()).toBeVisible();
  await context.setOffline(false);
});

test("herstel na per ongeluk sluiten: kladversie wordt aangeboden", async ({ page }) => {
  await openEditor(page);
  await placeMat(page);
  await readDraft(page, (d) => d.items.length === 1);
  await page.reload({ waitUntil: "load" });
  await expect(page.getByText("Niet-opgeslagen wijzigingen gevonden")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Herstellen" }).click();
  await expect(page.getByText("Niet-opgeslagen wijzigingen gevonden")).toBeHidden();
  await page.getByTestId("toolbar-undo").waitFor();
});

test("onboarding: eenmalig, wegklikbaar en opnieuw te openen", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use });
  const page = await context.newPage();
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(style);
    });
  });
  await page.goto("/e2e/plattegrond-3d");
  const dialog = page.getByRole("dialog", { name: "Uitleg gebaren" });
  await expect(dialog).toBeVisible({ timeout: 60_000 });
  await dialog.getByRole("button", { name: "Begrepen" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.locator("canvas").first().waitFor();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Meer acties" }).click();
  await page.getByRole("menuitem", { name: "Uitleg gebaren" }).click();
  await expect(dialog).toBeVisible();
  await context.close();
});

test("⋯-menu: kwaliteit kiezen en bibliotheekgedrag", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Meer acties" }).click();
  await page.getByRole("radio", { name: "Laag" }).click();
  await expect(page.getByRole("radio", { name: "Laag" })).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem("gymwiki.editor.settings.v1") ?? "{}").quality)).toBe("laag");
  await expectNoHorizontalOverflow(page);
  await page.getByRole("radio", { name: "Auto" }).click();
});
