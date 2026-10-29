import { expect, test } from "@playwright/test";

// De preview die de editor bij het opslaan maakt (FloorplanThumbnailCapture) is 2× uitgerekend: 1600 × 900 i.p.v. 800 × 450, zodat
// de bibliotheekkaart (die hem verkleind toont) geen korrelige lijnen en figuren krijgt, en blijft onder de uploadlimiet (600 KB).
test("de preview-opname is scherp (1600 × 900) en past in de uploadlimiet", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "één keer volstaat");
  await page.goto("/e2e/thumbnail", { waitUntil: "load" });
  const opname = page.getByTestId("opname");
  await expect(opname).toBeVisible({ timeout: 90_000 });
  expect(Number(await opname.getAttribute("data-width"))).toBe(1600);
  expect(Number(await opname.getAttribute("data-height"))).toBe(900);
  expect(Number(await opname.getAttribute("data-bytes"))).toBeLessThan(600 * 1024);
});
