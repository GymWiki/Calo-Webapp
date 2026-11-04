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

const ALWAYS_IDS = ["werkbalk-selecteren", "werkbalk-veld", "werkbalk-touw", "werkbalk-raster", "werkbalk-raster-stap", "werkbalk-botsing", "werkbalk-camera-reset"];
const SETTINGS_IDS = ["werkbalk-verbergen", "werkbalk-positie", "werkbalk-reset-indeling"];

for (const size of [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
]) {
  test(`desktop ${size.width}x${size.height}: opslaan en undo/redo in beeld; werkbalk over de volle breedte van het canvas, onder het canvas, zonder overlap`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-viewports");
    await page.setViewportSize(size);
    await openEditor(page);
    await inViewport(page, page.getByRole("button", { name: "Opslaan" }));
    await inViewport(page, page.getByRole("button", { name: /Ongedaan maken/ }));
    await inViewport(page, page.getByRole("button", { name: /Opnieuw/ }).first());
    await inViewport(page, page.getByPlaceholder(/Zoek materiaal/));

    // Volle breedte van het canvasgebied, direct onder het canvas (de zaal verdwijnt er nooit achter), geen horizontale scroll.
    const bar = await inViewport(page, page.getByTestId("canvas-werkbalk"));
    const canvas = (await page.locator("canvas").first().boundingBox())!;
    expect(Math.abs(bar.x - canvas.x), "werkbalk begint waar het canvas begint").toBeLessThanOrEqual(2);
    expect(Math.abs(bar.width - canvas.width), "werkbalk is net zo breed als het canvas").toBeLessThanOrEqual(2);
    expect(canvas.y + canvas.height, "canvas eindigt boven de werkbalk").toBeLessThanOrEqual(bar.y + 1);
    expect(bar.height).toBeGreaterThanOrEqual(52);
    expect(bar.height).toBeLessThanOrEqual(66);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.getByTestId("canvas-werkbalk").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

    // Knoppen: ≥ 44 px, zonder overlap, één regel; labels alleen bij een brede werkbalk.
    const wide = bar.width >= 640;
    const ids = [...ALWAYS_IDS, ...(wide ? SETTINGS_IDS : ["werkbalk-meer"])];
    const boxes = [];
    for (const id of ids) {
      const button = page.getByTestId(id);
      boxes.push({ id, box: await inViewport(page, button) });
      await expect(button).toHaveAttribute("aria-label", /.+/);
      await expect(button).toHaveAttribute("title", /.+/);
      expect((await button.boundingBox())!.height, id).toBeGreaterThanOrEqual(43.5);
    }
    if (!wide) for (const id of SETTINGS_IDS) await expect(page.getByTestId(id)).toBeHidden();
    const sorted = [...boxes].sort((first, second) => first.box.x - second.box.x);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].box.x, `${sorted[i].id} overlapt niet met ${sorted[i - 1].id}`).toBeGreaterThanOrEqual(sorted[i - 1].box.x + sorted[i - 1].box.width - 0.5);
    const label = (await page.getByTestId("werkbalk-selecteren").innerText()).trim();
    if (bar.width >= 1100) expect(label).toBe("Selecteren");
    else expect(label).toBe("");

    // Geen camerastanden of zoomknoppen en geen dubbele knoppen buiten de werkbalk.
    for (const id of ["werkbalk-camera-standaard", "werkbalk-camera-boven", "werkbalk-camera-vrij", "werkbalk-zoom-in", "werkbalk-zoom-uit", "knop-touw", "knop-botsing"]) await expect(page.getByTestId(id)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Veld afzetten/ })).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^Touw/ })).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^Botsing/ })).toHaveCount(1);
  });
}

test("desktop: raster (aan/uit en stap in één regel), botsing en gereedschappen werken vanaf de werkbalk; positie wordt onthouden; Reset zet terug", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop");
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await openEditor(page);
  const raster = page.getByTestId("werkbalk-raster");
  await expect(raster).toHaveAttribute("aria-label", /Raster: aan \(0,1\sm\)/);
  await raster.click();
  await expect(raster).toHaveAttribute("aria-label", /Raster: uit/);
  await raster.click();
  await expect(raster).toHaveAttribute("aria-label", /Raster: aan \(0,1\sm\)/);

  // Rastermenu: segmentknoppen op één regel, "0,1 m" met niet-brekende spatie; kiezen sluit het menu.
  await page.getByTestId("werkbalk-raster-stap").click();
  const menu = page.getByTestId("raster-stap-menu");
  await expect(menu).toBeVisible();
  for (const step of ["0", "0.1", "0.5"]) {
    const option = page.getByTestId(`raster-stap-${step}`);
    expect((await option.boundingBox())!.height, `stap ${step} staat op één regel`).toBeLessThanOrEqual(44);
  }
  expect(await page.getByTestId("raster-stap-0.1").innerText()).toBe("0,1\u00a0m");
  // Pijltjestoetsen kiezen de stap.
  await page.getByTestId("raster-stap-0.1").focus();
  await page.keyboard.press("ArrowRight");
  await expect(raster).toHaveAttribute("aria-label", /Raster: aan \(0,5\sm\)/);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await page.getByTestId("werkbalk-raster-stap").click();
  await page.getByTestId("raster-stap-0.1").click();
  await expect(raster).toHaveAttribute("aria-label", /Raster: aan \(0,1\sm\)/);
  await expect(menu).toHaveCount(0);
  // Klik buiten sluit het menu.
  await page.getByTestId("werkbalk-raster-stap").click();
  await expect(menu).toBeVisible();
  await page.locator("canvas").first().click({ position: { x: 40, y: 40 } });
  await expect(menu).toHaveCount(0);

  const botsing = page.getByTestId("werkbalk-botsing");
  await botsing.click();
  await expect(botsing).toHaveAttribute("aria-pressed", "false");
  await expect(botsing).toHaveAttribute("aria-label", /Botsing: negeren/);
  await botsing.click();
  await expect(botsing).toHaveAttribute("aria-label", /Botsing: waarschuwen/);

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

  // Positie: boven (canvas eronder), verbergen, herladen = onthouden, Reset indeling.
  await page.getByTestId("werkbalk-positie").click();
  const top = await page.getByTestId("canvas-werkbalk").boundingBox();
  const canvasBox = await page.locator("canvas").first().boundingBox();
  expect(top!.y + top!.height).toBeLessThanOrEqual(canvasBox!.y + 1);
  await page.getByTestId("werkbalk-verbergen").click();
  await expect(page.getByTestId("canvas-werkbalk")).toHaveCount(0);
  await page.reload({ waitUntil: "load" });
  await expect(page.getByTestId("werkbalk-tonen")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("werkbalk-tonen").click();
  await expect(page.getByTestId("canvas-werkbalk")).toBeVisible();
  const bottomBar = await page.getByTestId("canvas-werkbalk").boundingBox();
  expect(bottomBar!.y).toBeGreaterThan(400);
  expect(errors.filter((e) => !/favicon|WebGL|swiftshader|GPU stall|Failed to load resource/i.test(e))).toEqual([]);
});

test("smalle werkbalk (1024 px): de werkbalkinstellingen zitten in het Meer-menu", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop");
  await page.setViewportSize({ width: 1024, height: 768 });
  await openEditor(page);
  await page.getByTestId("werkbalk-meer").click();
  await expect(page.getByTestId("werkbalk-meer-menu")).toBeVisible();
  await page.getByTestId("werkbalk-meer-positie").click();
  const bar = await page.getByTestId("canvas-werkbalk").boundingBox();
  const canvas = await page.locator("canvas").first().boundingBox();
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(canvas!.y + 1); // nu boven het canvas
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
