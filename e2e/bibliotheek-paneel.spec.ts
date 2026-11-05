import { expect, test, type Locator, type Page } from "@playwright/test";

import { openEditor } from "./helpers";

// Bibliotheekpaneel: de kop (Materiaal/Personen, zoekbalk, weergave, sportfilter) staat vast; alleen de lijst eronder scrolt.
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

async function openLibrary(page: Page) {
  await openEditor(page);
  if (!isDesktop(page)) {
    await page.getByTestId("toolbar-bibliotheek").click();
    await page.waitForTimeout(700); // sheet-animatie
  }
}

async function openAllCategories(page: Page) {
  const closed = page.locator('[data-testid^="categorie-kop-"] button[aria-expanded="false"]');
  for (let guard = 0; guard < 20 && (await closed.count()) > 0; guard++) {
    await closed.first().click();
    await page.waitForTimeout(150);
  }
}

const box = async (locator: Locator) => (await locator.boundingBox())!;

async function headerBoxes(page: Page) {
  const kop = page.getByTestId("bibliotheek-kop");
  return {
    tabs: await box(kop.getByRole("group", { name: "Materiaal of personen" })),
    search: await box(kop.getByRole("searchbox")),
    chips: await box(page.getByTestId("sport-chips")),
    kop: await box(kop),
  };
}

for (const size of [
  { width: 1366, height: 600 },
  { width: 1920, height: 700 },
  { width: 1024, height: 600 },
]) {
  test(`desktop ${size.width}x${size.height}: kop blijft op zijn plek bij scrollen, alleen de lijst scrolt, geen restanten boven de zoekbalk`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-viewports");
    await page.setViewportSize(size);
    await openLibrary(page);
    const before = await headerBoxes(page);
    await openAllCategories(page);
    const list = page.getByTestId("paneel-lijst").first();
    const panel = page.getByTestId("bibliotheek-paneel");

    // Het paneel zelf scrolt niet; de lijst wel.
    expect(await panel.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await page.waitForTimeout(250);
    expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(50);
    expect(await panel.evaluate((el) => el.scrollTop)).toBe(0);

    // De kop staat na het scrollen exact op dezelfde plek (geen layoutverschuiving, ook niet door de scrollbalk).
    const after = await headerBoxes(page);
    for (const key of ["tabs", "search", "chips", "kop"] as const) expect(after[key], key).toEqual(before[key]);

    // Niets van de lijst loopt boven of door de kop: de lijst begint onder de kop, en bij het scrollen blijven de koppen binnen de lijst.
    const body = await box(list);
    expect(body.y).toBeGreaterThanOrEqual(after.kop.y + after.kop.height - 1);
    // Boven de lijst ligt alleen de kop: op de plek van de zoekbalk en de chips ligt nooit een stuk van een categorie.
    for (const key of ["search", "chips", "tabs"] as const) {
      const rect = after[key];
      const owner = await page.evaluate(([cx, cy]) => document.elementFromPoint(cx, cy)?.closest('[data-testid="paneel-lijst"]') !== null, [rect.x + rect.width / 2, rect.y + rect.height / 2]);
      expect(owner, `${key} wordt niet door de lijst afgedekt`).toBe(false);
    }
    // De kop heeft na scrollen een onderrand/schaduw.
    expect(await page.getByTestId("paneel-kop").first().evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
  });
}

test("subfilters van een open categorie worden nooit door de categoriekop afgedekt", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop");
  await page.setViewportSize({ width: 1366, height: 600 });
  await openLibrary(page);
  await openAllCategories(page);
  const list = page.getByTestId("paneel-lijst").first();
  const tablist = page.getByRole("tablist", { name: /Subgroepen van Toestellen/ });
  await tablist.scrollIntoViewIfNeeded();
  // Scrol een stukje de categorie in zodat de kop plakt; de subfilters (in hetzelfde plakkende blok) blijven volledig zichtbaar.
  await list.evaluate((el) => (el.scrollTop = el.scrollTop + 40));
  await page.waitForTimeout(250);
  const tabs = await tablist.getByRole("tab").all();
  expect(tabs.length).toBeGreaterThan(1);
  for (const tab of tabs) {
    const rect = await box(tab);
    const covered = await tab.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !(top === el || el.contains(top));
    });
    expect(covered, `subfilter "${await tab.innerText()}" is zichtbaar`).toBe(false);
    expect(rect.height).toBeGreaterThan(15);
  }
});

test("zoeken scrolt de lijst naar boven en de kop blijft staan; Materiaal/Personen houdt dezelfde kop; Filters wissen werkt", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop");
  await page.setViewportSize({ width: 1366, height: 600 });
  await openLibrary(page);
  const before = await headerBoxes(page);
  await openAllCategories(page);
  const list = page.getByTestId("paneel-lijst").first();
  await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await page.getByRole("searchbox").fill("bank");
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(0);
  expect((await headerBoxes(page)).search).toEqual(before.search);
  await page.getByRole("searchbox").fill("bestaatniet");
  await expect(page.getByText("Geen materiaal gevonden")).toBeVisible();
  await page.getByRole("button", { name: "Filters wissen" }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  // Personen: dezelfde tabs bovenaan, de lijst eronder.
  const tabs = before.tabs;
  await page.getByRole("button", { name: /^Personen/ }).click();
  expect(await box(page.getByTestId("bibliotheek-kop").getByRole("group", { name: "Materiaal of personen" }))).toEqual(tabs);
  await expect(page.getByTestId("paneel-lijst").first()).toBeVisible();
  await page.getByRole("button", { name: "Materiaal", exact: true }).click();
  await expect(page.getByRole("searchbox")).toBeVisible();
});

test("telefoon: in het bibliotheeksheet blijft de kop staan en scrolt alleen de lijst", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop" || testInfo.project.name === "ipad", "telefoon");
  await openLibrary(page);
  const before = await headerBoxes(page);
  await openAllCategories(page);
  const list = page.getByTestId("paneel-lijst").first();
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await page.waitForTimeout(250);
  const after = await headerBoxes(page);
  for (const key of ["tabs", "search", "chips", "kop"] as const) expect(after[key], key).toEqual(before[key]);
  // Het sheet zelf scrolt niet.
  const dialog = page.getByRole("dialog");
  expect(await dialog.evaluate((el) => Array.from(el.querySelectorAll<HTMLElement>("*")).filter((node) => node.dataset.testid !== "paneel-lijst" && node.scrollHeight > node.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(node).overflowY)).length)).toBe(0);
});

test("screenshots (voor/na) en hoogte van de kop", async ({ page }, testInfo) => {
  const shot = process.env.SHOT ?? "na";
  if (isDesktop(page) || testInfo.project.name === "desktop") await page.setViewportSize({ width: 1366, height: 768 });
  await openLibrary(page);
  await openAllCategories(page);
  const list = page.getByTestId("paneel-lijst").first();
  const kop = page.getByTestId("bibliotheek-kop");
  if ((await kop.count()) > 0) console.log("KOPHOOGTE", testInfo.project.name, Math.round((await box(kop)).height));
  await page.screenshot({ path: `docs/bibliotheek-paneel/${testInfo.project.name}-open-${shot}.png` });
  const scroller = (await list.count()) > 0 ? list : page.locator('aside.overflow-y-auto, [role="dialog"] .overflow-y-auto').first();
  await scroller.evaluate((el) => (el.scrollTop = Math.round(el.scrollHeight * 0.45)));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `docs/bibliotheek-paneel/${testInfo.project.name}-gescrold-${shot}.png` });
});
