import { expect, test } from "@playwright/test";

// Succespagina na Stripe-checkout: activeert server-side en pollt de pro-status. De API-aanroepen zijn gemockt
// (geen Stripe/Supabase nodig); de echte server-logica staat in lib/stripe/*.test.ts.
const URL = "/e2e/checkout-activation?session_id=cs_test_123";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop" && testInfo.project.name !== "iphone-14", "twee projecten volstaan");
});

test("bevestiging slaagt direct → 'account geactiveerd'", async ({ page }) => {
  await page.route("**/api/stripe/confirm-checkout", (route) => route.fulfill({ json: { result: "synced", paid: true } }));
  await page.goto(URL);
  await expect(page.getByTestId("checkout-done")).toBeVisible();
});

test("vertraagde webhook: eerst 'activeren…', daarna pollen tot pro", async ({ page }) => {
  let polls = 0;
  await page.route("**/api/stripe/confirm-checkout", (route) => route.fulfill({ json: { result: "none", paid: false } }));
  await page.route("**/api/subscription/status", (route) => {
    polls += 1;
    return route.fulfill({ json: { paid: polls >= 3 } });
  });
  await page.goto(URL);
  await expect(page.getByTestId("checkout-activating")).toBeVisible();
  await expect(page.getByTestId("checkout-done")).toBeVisible({ timeout: 15_000 });
  expect(polls).toBeGreaterThanOrEqual(3);
});

test("webhook blijft uit: duidelijke melding, 'Opnieuw proberen' en supportlink; daarna alsnog geactiveerd", async ({ page }) => {
  test.setTimeout(60_000);
  let paid = false;
  await page.route("**/api/stripe/confirm-checkout", (route) => route.fulfill({ json: { result: "none", paid: false } }));
  await page.route("**/api/subscription/status", (route) => route.fulfill({ json: { paid } }));
  await page.goto(URL);
  await expect(page.getByTestId("checkout-slow")).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("link", { name: "info@gymwiki.nl" })).toHaveAttribute("href", /^mailto:info@gymwiki\.nl/);
  paid = true;
  await page.getByRole("button", { name: "Opnieuw proberen" }).click();
  await expect(page.getByTestId("checkout-done")).toBeVisible({ timeout: 15_000 });
});

test("netwerkfout bij bevestigen valt terug op pollen", async ({ page }) => {
  await page.route("**/api/stripe/confirm-checkout", (route) => route.abort());
  await page.route("**/api/subscription/status", (route) => route.fulfill({ json: { paid: true } }));
  await page.goto(URL);
  await expect(page.getByTestId("checkout-done")).toBeVisible({ timeout: 15_000 });
});
