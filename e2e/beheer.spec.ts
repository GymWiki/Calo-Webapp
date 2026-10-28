import { expect, test } from "@playwright/test";

import { openEditor } from "./helpers";

// Toegangsregels van /beheer voor anonieme bezoekers en de beheeronderdelen van de editor (testroute). Inloggen als owner kan lokaal
// niet (er is geen lokale Supabase-stack); de rechten per rol zijn getest in supabase/tests (npm run test:rls).
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop + telefoons volstaan");
});

for (const path of ["/beheer", "/beheer/activiteiten/een-id", "/beheer/ai-import", "/beheer/taalcheck"]) {
  test(`anoniem: ${path} stuurt naar de inlogpagina`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/login\?redirectTo=/);
    await expect(page.locator("main")).not.toContainText("Activiteiten");
  });
}

test("editor zonder beheermodus toont geen Beheer-badge", async ({ page }) => {
  await openEditor(page);
  await expect(page.getByTestId("admin-badge")).toHaveCount(0);
});

test("editor in beheermodus: badge met eigenaar en activiteit, versiedialoog zonder crash", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("gymwiki.editor.onboarding.v1", "1");
    } catch {
      // geen localStorage
    }
  });
  await page.goto("/e2e/plattegrond-3d?beheer=1");
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  const badge = page.getByTestId("admin-badge");
  await expect(badge).toBeVisible();
  await expect(badge).toContainText("Beheer");
  await expect(badge).toHaveAttribute("title", /Test Eigenaar.*Testactiviteit/);
  await badge.click();
  const dialog = page.getByTestId("admin-versions-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Eigenaar: Test Eigenaar/)).toBeVisible();
  // Zonder sessie weigert de server-actie: een nette melding, geen versielijst en geen crash.
  await expect(dialog.getByRole("alert")).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("bibliotheekkaart: Bewerken-knop alleen voor beheerders, kaartlink blijft werken", async ({ page }) => {
  await page.goto("/e2e/activiteit-plattegrond");
  await expect(page.getByTestId("bibliotheekkaart").getByTestId("kaart-bewerken")).toHaveCount(0);

  await page.goto("/e2e/activiteit-plattegrond?beheer=1");
  const card = page.getByTestId("bibliotheekkaart");
  const edit = card.getByTestId("kaart-bewerken");
  await expect(edit).toBeVisible();
  await expect(edit).toHaveAttribute("href", /^\/beheer\/activiteiten\/.+/);
  await expect(card.getByRole("link", { name: /Testactiviteit/ }).first()).toHaveAttribute("href", /^\/activiteit\//);
  const box = await edit.boundingBox();
  expect(box && box.height >= 28).toBe(true);
});
