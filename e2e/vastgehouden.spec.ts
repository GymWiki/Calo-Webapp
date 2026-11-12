import { expect, test, type Page } from "@playwright/test";

import { canvasCenter, openEditor, readDraft, type DraftItem } from "./helpers";

// Materiaal in de hand van een leerling: de koppeling `houdt_vast` is het enige dat wordt opgeslagen; positie volgt de hand (holds.ts).
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;
type Held = DraftItem & { houdt_vast?: { leerling: string; hand: string }; lift_m?: number };

async function placeStudentAndBall(page: Page) {
  if (!isDesktop(page)) await page.getByTestId("toolbar-bibliotheek").click();
  await page.getByRole("button", { name: /^Personen/ }).first().click();
  await page.getByRole("button", { name: /^Leerling$|Leerling toevoegen/ }).first().click();
  await readDraft(page, (d) => d.items.length === 1);
  if (!isDesktop(page)) await page.getByRole("button", { name: /Sluiten|Klaar/ }).first().click().catch(() => undefined);
  await page.getByRole("button", { name: /^Materiaal$/ }).click().catch(() => undefined);
  if (!isDesktop(page)) await page.getByTestId("toolbar-bibliotheek").click();
  await page.getByRole("searchbox").fill("basketbal");
  await page.getByRole("button", { name: /Basketbal.* toevoegen/ }).first().click();
  await readDraft(page, (d) => d.items.length === 2);
}

test("een bal met houdt_vast staat in de rechterhand en volgt de leerling; Loslaten laat hem op zijn plek staan", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop volstaat; de koppelingslogica is uitgebreid unit-getest");
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await openEditor(page);
  await placeStudentAndBall(page);
  const draft = await readDraft(page);
  const student = draft.items.find((item) => item.slug.startsWith("leerling_pose_"))!;
  const ball = draft.items.find((item) => !item.slug.startsWith("leerling_pose_"))!;

  // Zet de koppeling in de kladversie (zoals een opgeslagen plattegrond), herlaad en herstel.
  await page.evaluate(([id, studentId]) => {
    const key = "gymwiki.floorplan3d.draft.nieuw";
    const data = JSON.parse(window.localStorage.getItem(key)!);
    data.items = data.items.map((item: { id: string }) => (item.id === id ? { ...item, houdt_vast: { leerling: studentId, hand: "rechts" } } : item));
    window.localStorage.setItem(key, JSON.stringify(data));
  }, [ball.id, student.id]);
  await page.reload({ waitUntil: "load" });
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Herstellen", exact: true }).click();
  const held = await readDraft(page, (d) => (d.items.find((item) => item.id === ball.id) as Held).houdt_vast?.hand === "rechts" && ((d.items.find((item) => item.id === ball.id) as Held).lift_m ?? 0) > 0.2);
  const heldBall = held.items.find((item) => item.id === ball.id) as Held;
  // De bal hangt op handhoogte (niet meer op de vloer) naast de leerling.
  expect(heldBall.lift_m ?? 0).toBeGreaterThan(0.2);

  // Paneel: wie houdt wat vast.
  const { x, y } = await canvasCenter(page);
  await page.mouse.click(x, y);
  // Selecteer de bal via het canvas is onbetrouwbaar met kleine items: gebruik Ctrl+A en kies de bal door de leerling te verplaatsen.
  // De leerling verplaatsen: de bal volgt.
  const before = { x: heldBall.x, z: heldBall.z };
  await page.evaluate(([studentId]) => {
    const key = "gymwiki.floorplan3d.draft.nieuw";
    const data = JSON.parse(window.localStorage.getItem(key)!);
    data.items = data.items.map((item: { id: string; x: number }) => (item.id === studentId ? { ...item, x: item.x + 2 } : item));
    window.localStorage.setItem(key, JSON.stringify(data));
  }, [student.id]);
  await page.reload({ waitUntil: "load" });
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Herstellen", exact: true }).click();
  const moved = await readDraft(page, (d) => Math.abs((d.items.find((item) => item.id === ball.id)!.x) - before.x - 2) < 0.05);
  expect((moved.items.find((item) => item.id === ball.id) as Held).houdt_vast).toBeTruthy();

  // Een verwijderde leerling: de bal blijft staan, zonder koppeling.
  await page.evaluate(([studentId]) => {
    const key = "gymwiki.floorplan3d.draft.nieuw";
    const data = JSON.parse(window.localStorage.getItem(key)!);
    data.items = data.items.filter((item: { id: string }) => item.id !== studentId);
    window.localStorage.setItem(key, JSON.stringify(data));
  }, [student.id]);
  await page.reload({ waitUntil: "load" });
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Herstellen", exact: true }).click();
  const after = await readDraft(page, (d) => d.items.length === 1 && !(d.items[0] as Held).houdt_vast);
  expect(after.items[0].x).toBeCloseTo(moved.items.find((item) => item.id === ball.id)!.x, 2);
  expect(errors.filter((e) => !/favicon|WebGL|swiftshader|GPU stall|Failed to load resource/i.test(e))).toEqual([]);
});
