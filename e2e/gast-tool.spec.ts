import { expect, test, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow, placeFromLibrary, readDraft } from "./helpers";

// Gratis tool zonder account: /gratis-gymzaal-plattegrond-maken — desktop, iPhone 14 en Pixel 7 (de iPad-run wordt overgeslagen).
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name === "ipad", "desktop + telefoons volstaan");
});

const PATH = "/gratis-gymzaal-plattegrond-maken";
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 640;

async function prepare(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("gymwiki.editor.onboarding.v1", "1");
    } catch {
      // geen localStorage
    }
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(style);
    });
  });
}

test("tekstpagina: H1, headings, FAQ en geen horizontale scroll; editor laadt nog niet", async ({ page }) => {
  await prepare(page);
  await page.goto(PATH);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gratis gymzaal plattegrond maken in 3D");
  expect(await page.locator("h1").count()).toBe(1);
  expect(await page.locator("h2").count()).toBeGreaterThanOrEqual(5);
  expect(await page.locator("dt").count()).toBeGreaterThanOrEqual(8);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("editor starten zonder account, item plaatsen, exportmenu en lokaal herstel", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && !request.url().includes("/_next/")) writes.push(`${request.method()} ${request.url()} action=${request.headers()["next-action"] ?? "-"} body=${(request.postData() ?? "").slice(0, 80)}`);
  });
  await prepare(page);
  await page.goto(PATH);
  await page.getByTestId("start-editor").click();
  await expect(page.getByTestId("gast-editor")).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1500);

  if (isPhone(page)) await placeFromLibrary(page, /^Matten/, /Testmat groot toevoegen/);
  else {
    await page.getByRole("button", { name: /^Matten/ }).first().click();
    await page.getByRole("button", { name: /Testmat groot toevoegen/ }).click();
  }
  await readDraft(page, (d) => d.items.length === 1);

  // Exportmenu bereikbaar
  await page.getByRole("button", { name: "Delen en exporteren" }).first().click();
  await expect(page.getByRole("menuitem", { name: /Afbeelding \(3D\)/ })).toBeVisible();
  await page.keyboard.press("Escape");

  // Sluiten en opnieuw openen herstelt de kladversie
  await page.getByRole("button", { name: /Editor sluiten|Sluiten/ }).first().click();
  await expect(page.getByTestId("gast-editor")).toHaveCount(0);
  await page.getByTestId("start-editor").click();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await readDraft(page, (d) => d.items.length === 1);

  expect(writes, `onverwachte schrijfverzoeken: ${writes.join(", ")}`).toEqual([]);
  expect(errors).toEqual([]);
  if (isPhone(page)) await expectNoHorizontalOverflow(page);
});

test("voorbeeld openen via #voorbeeld=", async ({ page }) => {
  await prepare(page);
  await page.goto(`${PATH}#voorbeeld=veld-afzetten`);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('input[value="Veld afzetten met pionnen"]').first()).toBeVisible();
});

test("anonieme /plattegrond-3d stuurt door naar de gratis tool", async ({ page }) => {
  await prepare(page);
  await page.goto("/plattegrond-3d");
  await expect(page).toHaveURL(new RegExp(`${PATH}`));
});
