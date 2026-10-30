import { expect, test, type Page } from "@playwright/test";

import { openEditor } from "./helpers";

// Waarschuwing bij het verlaten van de editor met wijzigingen die nog niet goed zijn opgeslagen. De testpagina heeft geen login,
// dus opslaan op de server mislukt: de wijziging blijft "onopgeslagen" (precies het geval waar de waarschuwing voor is).
const EDITOR_PATH = "/e2e/plattegrond-3d";

async function addLink(page: Page) {
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "/e2e/viewer-framing";
    link.textContent = "Naar de bibliotheek";
    link.setAttribute("data-testid", "testlink");
    link.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:9999;background:#fff;padding:8px";
    document.body.appendChild(link);
  });
}

async function makeChange(page: Page) {
  const name = page.getByRole("textbox").first();
  await name.fill("Mijn plattegrond");
  // De autosave (na ±1,5 s) mislukt zonder login, dus de wijziging staat daarna nog open.
  await page.waitForTimeout(3000);
}

test("zonder wijzigingen verlaat je de editor zonder waarschuwing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop en telefoon volstaan");
  await openEditor(page);
  await addLink(page);
  await page.getByTestId("testlink").click();
  await expect(page).toHaveURL(/viewer-framing/);
});

test("met onopgeslagen wijzigingen vraagt een klik op een link eerst om bevestiging", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop en telefoon volstaan");
  await openEditor(page);
  await makeChange(page);
  await addLink(page);

  await page.getByTestId("testlink").click();
  await expect(page.getByTestId("onopgeslagen-dialoog")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(EDITOR_PATH));

  // Blijven: dialoog weg, editor en wijziging intact.
  await page.getByTestId("onopgeslagen-blijven").click();
  await expect(page.getByTestId("onopgeslagen-dialoog")).toBeHidden();
  await expect(page).toHaveURL(new RegExp(EDITOR_PATH));
  await expect(page.getByRole("textbox").first()).toHaveValue("Mijn plattegrond");

  // Verlaten zonder opslaan: de link wordt alsnog gevolgd.
  await page.getByTestId("testlink").click();
  await page.getByTestId("onopgeslagen-verlaten").click();
  await expect(page).toHaveURL(/viewer-framing/);
});

test("de terugknop van de browser waarschuwt ook, en blijven houdt je in de editor", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "één keer volstaat");
  await page.goto("/e2e/viewer-framing", { waitUntil: "load" });
  await page.evaluate(() => window.localStorage.setItem("gymwiki.editor.onboarding.v1", "1"));
  await page.goto(EDITOR_PATH, { waitUntil: "load" });
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await makeChange(page);

  await page.goBack();
  await expect(page.getByTestId("onopgeslagen-dialoog")).toBeVisible();
  await page.getByTestId("onopgeslagen-blijven").click();
  await expect(page).toHaveURL(new RegExp(EDITOR_PATH));
  await expect(page.getByRole("textbox").first()).toHaveValue("Mijn plattegrond");

  // Nu echt terug: één keer terug is genoeg om de editor te verlaten.
  await page.goBack();
  await page.getByTestId("onopgeslagen-verlaten").click();
  await expect(page).toHaveURL(/viewer-framing/);
});
