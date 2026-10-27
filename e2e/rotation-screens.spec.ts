import { test, type Page } from "@playwright/test";

import { openEditor, placeFromLibrary, readDraft } from "./helpers";

// Screenshots voor de oplevering (docs/screenshots/rotatie). Alleen met E2E_SCREENSHOTS=1, anders overgeslagen.
test.skip(!process.env.E2E_SCREENSHOTS, "alleen met E2E_SCREENSHOTS=1");

const OUT = "docs/screenshots/rotatie";
const panel = (page: Page) => page.getByTestId("rotatie-paneel");
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

async function place(page: Page, category: RegExp, name: RegExp) {
  if (isDesktop(page)) {
    // Een categorie klapt open/dicht: alleen openen als het item nog niet zichtbaar is.
    const item = page.getByRole("button", { name }).first();
    if (!(await item.isVisible())) await page.getByRole("button", { name: category }).first().click();
    await item.click();
  } else {
    await placeFromLibrary(page, category, name);
  }
}

test("voor/na en contactsheet (desktop)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "alleen desktop");
  test.setTimeout(240_000);
  await openEditor(page);
  const canvas = page.locator("canvas").first();
  const count = async () => (await readDraft(page)).items.length;

  // Bank: plat → schuin 30° → rechtop.
  await place(page, /^Toestellen/, /Turnbank test toevoegen/);
  await page.getByRole("tab", { name: "Item" }).click();
  await canvas.screenshot({ path: `${OUT}/bank-1-plat.png` });
  await panel(page).getByRole("button", { name: "Schuin 30°" }).click();
  await page.waitForTimeout(500);
  await canvas.screenshot({ path: `${OUT}/bank-2-schuin-30.png` });
  await page.screenshot({ path: `${OUT}/desktop-paneel-en-ringen.png` });
  await panel(page).getByRole("button", { name: "Rechtop (90°)" }).click();
  await page.waitForTimeout(500);
  await canvas.screenshot({ path: `${OUT}/bank-3-rechtop.png` });

  // De bank van het voor/na-gedeelte weghalen, zodat de contactsheet schoon begint.
  await page.getByRole("button", { name: /Verwijderen/ }).click();
  await readDraft(page, (d) => d.items.length === 0);

  // Contactsheet: elk asset apart, in vier standen; de crops worden daarna op één pagina gezet.
  const assets: [RegExp, RegExp, string][] = [
    [/^Toestellen/, /Turnbank test toevoegen/, "Bank"],
    [/^Matten/, /Testmat groot toevoegen/, "Mat"],
    [/^Toestellen/, /Springplank test toevoegen/, "Springplank"],
    [/^Toestellen/, /Evenwichtsbalk test toevoegen/, "Balk"],
    [/^Doelen/, /Korfbalpaal test toevoegen/, "Doel (paal)"],
  ];
  const poses = ["Plat", "Schuin 30°", "Rechtop (90°)", "Op kop"];
  const box = (await canvas.boundingBox())!;
  const clip = { x: box.x + box.width / 2 - 120, y: box.y + box.height / 2 - 115, width: 240, height: 200 };
  const baseline = await count();
  const cells: { asset: string; pose: string; data: string }[] = [];
  // Wissel naar het bovenaanzicht-vrije standaardbeeld, ingezoomd zodat de items goed te zien zijn.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -2600);
  await page.waitForTimeout(600);
  for (const [category, name, label] of assets) {
    await place(page, category, name);
    await page.getByRole("tab", { name: "Item" }).click();
    for (const pose of poses) {
      await panel(page).getByRole("button", { name: pose, exact: true }).click();
      await page.waitForTimeout(400);
      // Zonder selectie-ringen fotograferen: klik op een lege hoek van het canvas.
      await page.mouse.click(box.x + 8, box.y + 8);
      await page.waitForTimeout(300);
      cells.push({ asset: label, pose, data: (await page.screenshot({ clip })).toString("base64") });
      // Opnieuw selecteren (het item staat in het midden van het beeld).
      const probes = [0, -8, -16, -24, -32, -48, -64, -96, 8, 16].flatMap((dy) => [0, 20, -20].map((dx) => [dx, dy]));
      for (const [dx, dy] of probes) {
        await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
        await page.getByRole("tab", { name: "Item" }).click();
        if (await panel(page).isVisible()) break;
      }
    }
    await page.getByRole("button", { name: /Verwijderen/ }).click();
    await readDraft(page, (d) => d.items.length === baseline);
  }
  const sheet = await page.context().newPage();
  await sheet.setViewportSize({ width: 1500, height: 1500 });
  await sheet.setContent(`<body style="margin:0;font:14px system-ui;background:#fff;padding:12px">
    <h2 style="margin:0 0 8px">Rotatie over alle assen \u2014 contactsheet</h2>
    <div style="display:grid;grid-template-columns:90px repeat(${poses.length},340px);gap:6px;align-items:center">
      <div></div>${poses.map((pose) => `<strong>${pose}</strong>`).join("")}
      ${assets.map(([, , label]) => `<strong>${label}</strong>${cells.filter((c) => c.asset === label).map((c) => `<img src="data:image/png;base64,${c.data}" width="340" style="border:1px solid #ddd">`).join("")}`).join("")}
    </div></body>`);
  await sheet.screenshot({ path: `${OUT}/contactsheet-assets.png`, fullPage: true });
  await sheet.close();
});

test("mobiele drawer (iPhone 14 / Pixel 7)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop" || testInfo.project.name === "ipad", "alleen telefoon");
  await openEditor(page);
  await placeFromLibrary(page, /^Toestellen/, /Turnbank test toevoegen/);
  await page.screenshot({ path: `${OUT}/${testInfo.project.name}-1-contextbalk.png` });
  await page.getByRole("button", { name: "Rotatie en kantelen" }).click();
  await panel(page).getByRole("button", { name: "Schuin 30°" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${testInfo.project.name}-2-drawer-schuin.png` });
  await panel(page).getByRole("button", { name: "Rechtop (90°)" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${testInfo.project.name}-3-drawer-rechtop.png` });
});
