import { expect, test, type Locator, type Page } from "@playwright/test";

import { canvasCenter, openEditor, placeFromLibrary } from "./helpers";

// UI-eisen van de editor: één rij iconen (desktop), camera altijd vrij (geen standen of zoomknoppen), Vaste onderdelen alleen switches.
async function inViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  const size = page.viewportSize()!;
  expect(box, "element heeft een positie").not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-0.5);
  expect(box!.y).toBeGreaterThanOrEqual(-0.5);
  expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 0.5);
  expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 0.5);
  return box!;
}

/** Aandeel pixels dat verschilt tussen twee canvas-screenshots (renderruis telt niet mee). */
async function diffRatio(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ([first, second]) => {
      const load = async (data: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const c = document.createElement("canvas");
        c.width = image.width;
        c.height = image.height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height).data;
      };
      const [x, y] = await Promise.all([load(first), load(second)]);
      let different = 0;
      for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 40) different++;
      return different / (x.length / 4);
    },
    [a.toString("base64"), b.toString("base64")],
  );
}

const TOOLBAR_IDS = ["werkbalk-selecteren", "werkbalk-veld", "werkbalk-touw", "werkbalk-raster", "werkbalk-raster-stap", "werkbalk-botsing", "werkbalk-verbergen", "werkbalk-positie", "werkbalk-reset-indeling", "werkbalk-camera-reset"];

for (const size of [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
]) {
  test(`desktop ${size.width}x${size.height}: opslaan, undo/redo en de werkbalk (één rij, alleen iconen) staan zonder scrollen in beeld`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-viewports");
    await page.setViewportSize(size);
    await openEditor(page);
    await inViewport(page, page.getByRole("button", { name: "Opslaan" }));
    await inViewport(page, page.getByRole("button", { name: /Ongedaan maken/ }));
    await inViewport(page, page.getByRole("button", { name: /Opnieuw/ }).first());
    await inViewport(page, page.getByPlaceholder(/Zoek materiaal/));

    // Eén rij: alle knoppen op dezelfde hoogte, ≥ 40 px, zonder tekstlabel, elk met tooltip en aria-label.
    const boxes = [];
    for (const id of TOOLBAR_IDS) {
      const button = page.getByTestId(id);
      boxes.push(await inViewport(page, button));
      await expect(button).toHaveAttribute("aria-label", /.+/);
      await expect(button).toHaveAttribute("title", /.+/);
      expect((await button.innerText()).trim(), `${id} heeft geen tekstlabel`).toBe("");
    }
    const tops = boxes.map((box) => Math.round(box.y + box.height / 2));
    expect(Math.max(...tops) - Math.min(...tops), "alle iconen staan op één rij").toBeLessThanOrEqual(2);
    for (const [index, id] of TOOLBAR_IDS.entries()) if (id !== "werkbalk-raster-stap") expect(boxes[index].width, id).toBeGreaterThanOrEqual(39.5);

    // Geen camerastanden of zoomknoppen meer.
    for (const id of ["werkbalk-camera-standaard", "werkbalk-camera-boven", "werkbalk-camera-vrij", "werkbalk-zoom-in", "werkbalk-zoom-uit"]) await expect(page.getByTestId(id)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Standaard|Bovenaanzicht|Vrij draaien)$/ })).toHaveCount(0);

    // De werkbalk verschuift het canvas niet.
    const before = await page.locator("canvas").first().boundingBox();
    await page.getByTestId("werkbalk-positie").click();
    const after = await page.locator("canvas").first().boundingBox();
    expect(after!.width).toBe(before!.width);
    expect(after!.height).toBe(before!.height);
  });
}

test("desktop: raster (aan/uit en stap), botsing en gereedschappen werken vanaf de werkbalk; positie wordt onthouden; Reset zet terug", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop");
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await openEditor(page);
  const raster = page.getByTestId("werkbalk-raster");
  await expect(raster).toHaveAttribute("aria-label", /Raster aan \(0,1 m\)/);
  await raster.click();
  await expect(raster).toHaveAttribute("aria-label", /Raster uit/);
  await raster.click();
  await expect(raster).toHaveAttribute("aria-label", /Raster aan \(0,1 m\)/);
  await page.getByTestId("werkbalk-raster-stap").click();
  await page.getByTestId("raster-stap-0.5").click();
  await expect(raster).toHaveAttribute("aria-label", /Raster aan \(0,5 m\)/);
  await expect(page.getByTestId("raster-stap-menu")).toHaveCount(0);

  const botsing = page.getByTestId("werkbalk-botsing");
  await botsing.click();
  await expect(botsing).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("knop-botsing")).toHaveAttribute("aria-pressed", "false"); // zijbalk deelt dezelfde state

  const selecteren = page.getByTestId("werkbalk-selecteren");
  await expect(selecteren).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("werkbalk-veld").click();
  await expect(page.getByTestId("werkbalk-veld")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("werkbalk-touw").click();
  await expect(page.getByTestId("werkbalk-touw")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("werkbalk-veld")).toHaveAttribute("aria-pressed", "false");
  await selecteren.click();
  await expect(selecteren).toHaveAttribute("aria-pressed", "true");

  // Toetsenbord: pijltje rechts verplaatst de focus binnen de werkbalk.
  await selecteren.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("werkbalk-veld")).toBeFocused();

  // Positie: boven, verbergen, herladen = onthouden, Reset indeling.
  await page.getByTestId("werkbalk-positie").click();
  const top = await page.getByTestId("canvas-werkbalk").boundingBox();
  expect(top!.y).toBeLessThan(200);
  await page.getByTestId("werkbalk-verbergen").click();
  await expect(page.getByTestId("canvas-werkbalk")).toHaveCount(0);
  await page.reload({ waitUntil: "load" });
  await expect(page.getByTestId("werkbalk-tonen")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("werkbalk-tonen").click();
  await page.getByTestId("werkbalk-reset-indeling").click();
  const bottom = await page.getByTestId("canvas-werkbalk").boundingBox();
  expect(bottom!.y).toBeGreaterThan(400);
  expect(errors.filter((e) => !/favicon|WebGL|swiftshader|GPU stall|Failed to load resource/i.test(e))).toEqual([]);
});

test("desktop: de camera is altijd vrij: slepen draait, scrollen zoomt, dubbelklik en het herstelicoon zetten terug", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "muis");
  await openEditor(page);
  const canvas = page.locator("canvas").first();
  const { x, y } = await canvasCenter(page);
  const start = await canvas.screenshot();

  // Slepen op leeg canvas draait de camera.
  await page.mouse.move(x - 250, y - 120);
  await page.mouse.down();
  await page.mouse.move(x - 120, y - 140, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const rotated = await canvas.screenshot();
  expect(await diffRatio(page, start, rotated)).toBeGreaterThan(0.02);

  // Scrollen zoomt.
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(400);
  const zoomed = await canvas.screenshot();
  expect(await diffRatio(page, rotated, zoomed)).toBeGreaterThan(0.02);

  // Het herstelicoon zet de camera terug naar de beginstand.
  await page.getByTestId("werkbalk-camera-reset").click();
  await page.waitForTimeout(600);
  expect(await diffRatio(page, start, await canvas.screenshot())).toBeLessThan(0.005);

  // Dubbelklik op een leeg stuk doet hetzelfde.
  await page.mouse.move(x - 250, y - 120);
  await page.mouse.down();
  await page.mouse.move(x - 120, y - 140, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.mouse.dblclick(x - 250, y + 200);
  await page.waitForTimeout(600);
  expect(await diffRatio(page, start, await canvas.screenshot())).toBeLessThan(0.005);
});

test("Kamer-paneel: Vaste onderdelen toont alleen de uitleg en de switches; een switch blijft bewaard en is één undo-stap", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop");
  await openEditor(page);
  // Een kladversie wordt pas aangeboden als er iets staat: plaats eerst een item.
  await page.getByRole("button", { name: /^Toestellen/ }).first().click();
  await page.getByRole("button", { name: /Turnbank test toevoegen/ }).click();
  await expect(page.getByRole("button", { name: /Alles weghalen|Standaardzaal herstellen|Lege zaal/ })).toHaveCount(0);
  await expect(page.getByText(/Wandrekken, baskets en vaste bankjes/)).toBeVisible();
  const hiddenNodes = () => page.evaluate(() => (JSON.parse(window.localStorage.getItem("gymwiki.floorplan3d.draft.nieuw") ?? "{}").room?.environment?.hidden ?? []) as string[]);
  const wandrekken = page.getByRole("switch", { name: "Wandrekken" });
  await expect(wandrekken).toBeChecked();
  await wandrekken.click();
  await expect(wandrekken).not.toBeChecked();
  // Undo zet de switch in één stap terug; opnieuw uitzetten.
  await page.getByRole("button", { name: /Ongedaan maken/ }).click();
  await expect(wandrekken).toBeChecked();
  await wandrekken.click();
  await expect.poll(async () => (await hiddenNodes()).some((node) => node.startsWith("Wandrek"))).toBe(true);
  // Herladen en de kladversie herstellen: de keuze blijft.
  await page.reload({ waitUntil: "load" });
  await page.getByRole("button", { name: "Herstellen", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Wandrekken" })).not.toBeChecked();
});

test("telefoon: onderwerkbalk zonder Camera-knop; camera herstellen als icoon op het canvas; één vinger draait, dubbeltik herstelt", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop" || testInfo.project.name === "ipad", "telefoon");
  await openEditor(page);
  await expect(page.getByTestId("toolbar-camera")).toHaveCount(0);
  const bar = page.getByTestId("mobiele-werkbalk");
  expect(await bar.getByRole("button").count()).toBe(5);
  const reset = page.getByTestId("camera-herstellen");
  const box = await inViewport(page, reset);
  expect(box.width).toBeGreaterThanOrEqual(43.5);
  expect(box.height).toBeGreaterThanOrEqual(43.5);
  await expect(page.getByTestId("toolbar-undo")).toBeVisible();

  const canvas = page.locator("canvas").first();
  const start = await canvas.screenshot();
  const { x, y } = await canvasCenter(page);
  const { touchDrag } = await import("./helpers");
  await touchDrag(page, { x: x - 100, y: y - 150 }, { x: x + 20, y: y - 120 }, 12);
  await page.waitForTimeout(400);
  expect(await diffRatio(page, start, await canvas.screenshot())).toBeGreaterThan(0.02);
  await reset.tap();
  await page.waitForTimeout(600);
  expect(await diffRatio(page, start, await canvas.screenshot())).toBeLessThan(0.005);

  await touchDrag(page, { x: x - 100, y: y - 150 }, { x: x + 20, y: y - 120 }, 12);
  await page.waitForTimeout(300);
  await page.touchscreen.tap(x - 120, y - 200);
  await page.touchscreen.tap(x - 120, y - 200);
  await page.waitForTimeout(600);
  expect(await diffRatio(page, start, await canvas.screenshot())).toBeLessThan(0.005);
});

test("telefoon: de selectiebalk past in beeld en alle knoppen zijn minstens 44 px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop" || testInfo.project.name === "ipad", "telefoon");
  await openEditor(page);
  await placeFromLibrary(page, /^Toestellen/, /Turnbank test toevoegen/);
  const bar = page.getByRole("toolbar", { name: /Acties voor/ });
  await expect(bar).toBeVisible();
  const buttons = bar.getByRole("button");
  const count = await buttons.count();
  expect(count).toBeGreaterThanOrEqual(8);
  for (let index = 0; index < count; index++) {
    const box = await inViewport(page, buttons.nth(index));
    expect(box.width).toBeGreaterThanOrEqual(43.5);
    expect(box.height).toBeGreaterThanOrEqual(43.5);
  }
  await inViewport(page, page.getByRole("button", { name: "Opslaan" }));
  await inViewport(page, page.getByRole("button", { name: "Ongedaan maken" }));
});
