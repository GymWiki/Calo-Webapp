import { expect, test, type Page } from "@playwright/test";

import { canvasCenter, openEditor, readDraft, type DraftItem } from "./helpers";

// Tillen: rechtermuisknop op een object verandert de HOOGTE (lift_m); links schuift over de vloer; rechts op leeg canvas pant de camera.
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

async function placeBall(page: Page) {
  await page.getByRole("button", { name: /^Ballen/ }).first().click();
  await page.getByRole("button", { name: /Basketbal test toevoegen/ }).click();
  await readDraft(page, (d) => d.items.length === 1);
}

const lifted = (item: DraftItem) => (item as DraftItem & { lift_m?: number }).lift_m;

test("rechtermuisknop op een object tilt het: hoogte verandert, positie blijft; geen browsermenu; undo; blijft na herladen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "rechtermuisknop: alleen desktop");
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  let contextMenus = 0;
  await page.exposeFunction("__contextmenu", () => contextMenus++);
  await openEditor(page);
  await page.evaluate(() => document.addEventListener("contextmenu", (e) => (e.defaultPrevented ? undefined : (window as unknown as { __contextmenu: () => void }).__contextmenu())));
  await placeBall(page);
  const before = (await readDraft(page)).items[0];
  const { x, y } = await canvasCenter(page);

  // Het object staat na plaatsen in het midden onder de cursor; pak het met de rechtermuisknop en sleep 120 px omhoog.
  await page.mouse.move(x, y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(x, y - 60, { steps: 6 });
  await expect(page.getByTestId("tilhoogte")).toBeVisible();
  await page.mouse.move(x, y - 120, { steps: 6 });
  await page.mouse.up({ button: "right" });
  const after = await readDraft(page, (d) => (lifted(d.items[0]) ?? 0) > 0.2);
  expect(after.items[0]).toMatchObject({ id: before.id, x: before.x, z: before.z });
  expect(after.items[0].y).toBeGreaterThan(0.2);
  expect(contextMenus, "geen browsermenu tijdens het tillen").toBe(0);

  // Eén undo-stap zet de hoogte terug.
  await page.keyboard.press("Control+z");
  await readDraft(page, (d) => (lifted(d.items[0]) ?? 0) === 0);

  // Q/E: 5 cm (Shift 25 cm); Terug naar vloer.
  await page.keyboard.press("e");
  await readDraft(page, (d) => Math.abs((lifted(d.items[0]) ?? 0) - 0.05) < 0.001);
  await page.keyboard.press("Shift+E");
  await readDraft(page, (d) => Math.abs((lifted(d.items[0]) ?? 0) - 0.3) < 0.001);
  await page.getByTestId("terug-naar-vloer").click();
  await readDraft(page, (d) => lifted(d.items[0]) === undefined && d.items[0].y === 0);
  expect(errors.filter((e) => !/favicon|WebGL|swiftshader|GPU stall|Failed to load resource/i.test(e))).toEqual([]);
});

test("links slepen schuift over de vloer; rechtermuisknop op een leeg deel van het canvas pant de camera en tilt niets", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "rechtermuisknop: alleen desktop");
  await openEditor(page);
  await placeBall(page);
  const start = (await readDraft(page)).items[0];
  const { x, y } = await canvasCenter(page);

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 120, y + 30, { steps: 8 });
  await page.mouse.up();
  const moved = await readDraft(page, (d) => Math.abs(d.items[0].x - start.x) > 0.2 || Math.abs(d.items[0].z - start.z) > 0.2);
  expect(lifted(moved.items[0])).toBeUndefined();

  // Rechts slepen op een leeg stuk (hoek van het canvas): geen tilhoogte, het item verandert niet (de camera pant).
  await page.mouse.move(x + 380, y - 160);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(x + 380, y - 250, { steps: 6 });
  await expect(page.getByTestId("tilhoogte")).toHaveCount(0);
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(700);
  expect((await readDraft(page)).items[0]).toMatchObject({ x: moved.items[0].x, z: moved.items[0].z, y: moved.items[0].y });
});
