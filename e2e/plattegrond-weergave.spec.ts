import { expect, test, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./helpers";

// Weergaveregel van het plattegrond-beeld (lib/activities/visual.ts) en het verdwijnen van de 2D-editor — op de testpagina
// /e2e/activiteit-plattegrond, die dezelfde componenten en dezelfde regel gebruikt als de echte pagina's (zonder login/Supabase).
const ACTIVITY_ID = "11111111-1111-4111-8111-111111111111";

type Collected = { errors: string[] };

async function open(page: Page, params: string): Promise<Collected> {
  const collected: Collected = { errors: [] };
  page.on("pageerror", (error) => collected.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") collected.errors.push(message.text());
  });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(style);
    });
  });
  await page.goto(`/e2e/activiteit-plattegrond?${params}`, { waitUntil: "load" });
  await expect(page.getByRole("heading", { name: "Plattegrond-weergave (test)" })).toBeVisible({ timeout: 60_000 });
  return collected;
}

const IMAGE = 'img[src*="gymwiki-logo"]';
const THUMB = 'img[src*="apple-touch-icon"]';
const viewer = (page: Page) => page.locator('section[aria-labelledby^="plattegrond-3d-"]');
const detail = (page: Page) => page.getByTestId("detail");

test.describe("alleen een afbeelding", () => {
  test("toont de afbeelding ongewijzigd, met 'Vervang door 3D-plattegrond' die de editor opent", async ({ page }) => {
    const { errors } = await open(page, "case=afbeelding&rol=eigenaar");
    await expect(detail(page).locator(IMAGE).first()).toBeVisible();
    await expect(viewer(page)).toHaveCount(0);
    await expect(page.getByTestId("bibliotheekkaart").locator(IMAGE)).toHaveCount(1);
    await expect(page.getByTestId("publieke-kaart").locator(IMAGE)).toHaveCount(1);

    const button = detail(page).getByRole("link", { name: "Vervang door 3D-plattegrond" });
    await expect(button).toHaveAttribute("href", `/plattegrond-3d?activiteit=${ACTIVITY_ID}`);
    const request = page.waitForRequest((req) => req.url().includes(`/plattegrond-3d?activiteit=${ACTIVITY_ID}`));
    await button.click();
    await request;
    expect(errors).toEqual([]);
  });

  test("een bezoeker ziet de afbeelding maar geen knop", async ({ page }) => {
    await open(page, "case=afbeelding&rol=bezoeker");
    await expect(detail(page).locator(IMAGE).first()).toBeVisible();
    await expect(detail(page).getByRole("link", { name: /3D-plattegrond|Plattegrond maken/ })).toHaveCount(0);
  });
});

for (const kind of ["3d", "beide"]) {
  test.describe(`3D-plattegrond (${kind})`, () => {
    test("toont alleen de 3D-viewer en nergens de afbeelding", async ({ page }) => {
      const { errors } = await open(page, `case=${kind}&rol=eigenaar`);
      await expect(viewer(page)).toHaveCount(1);
      await expect(viewer(page).getByRole("heading", { name: "Plattegrond" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      // De losse afbeelding komt nergens op de pagina voor: niet op de detailpagina, niet in de kaarten.
      await expect(page.locator(IMAGE)).toHaveCount(0);
      // Kaarten (bibliotheek + publiek) gebruiken de 3D-thumbnail.
      await expect(page.getByTestId("bibliotheekkaart").locator(THUMB)).toHaveCount(1);
      await expect(page.getByTestId("publieke-kaart").locator(THUMB)).toHaveCount(1);
      // Geen 'Vervang door'/'maken'-knop naast de viewer; wel 'Bewerken in editor' voor de eigenaar.
      await expect(page.getByRole("link", { name: /Vervang door 3D-plattegrond|Plattegrond maken/ })).toHaveCount(0);
      await expect(viewer(page).getByRole("link", { name: "Bewerken in editor" })).toBeVisible();
      expect(errors.filter((message) => !/THREE\.|GL Driver|WebGL/i.test(message))).toEqual([]);
    });

    test("OG- en Twitter-afbeelding zijn de 3D-thumbnail, niet de afbeelding", async ({ page }) => {
      await open(page, `case=${kind}&rol=bezoeker`);
      const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
      const twitter = await page.locator('meta[name="twitter:image"]').first().getAttribute("content");
      expect(og).toContain("apple-touch-icon");
      expect(twitter).toContain("apple-touch-icon");
      expect(`${og}${twitter}`).not.toContain("gymwiki-logo");
    });

    test("print toont de 3D-thumbnail in plaats van de interactieve viewer, en nooit de afbeelding", async ({ page }) => {
      await open(page, `case=${kind}&rol=bezoeker`);
      await page.emulateMedia({ media: "print" });
      await expect(viewer(page).locator('img[alt^="3D-plattegrond:"]')).toBeVisible();
      await expect(page.locator(IMAGE)).toHaveCount(0);
    });
  });
}

test.describe("geen afbeelding en geen 3D-plattegrond", () => {
  test("de eigenaar ziet 'Plattegrond maken'", async ({ page }) => {
    await open(page, "case=geen&rol=eigenaar");
    const button = detail(page).getByRole("link", { name: "Plattegrond maken" });
    await expect(button).toHaveAttribute("href", `/plattegrond-3d?activiteit=${ACTIVITY_ID}`);
    await expect(page.locator(IMAGE)).toHaveCount(0);
    await expect(viewer(page)).toHaveCount(0);
  });

  test("een bezoeker ziet niets", async ({ page }) => {
    await open(page, "case=geen&rol=bezoeker");
    await expect(detail(page).locator("*")).toHaveCount(0);
  });
});

for (const kind of ["ongeldig", "leeg"]) {
  test(`${kind}e 3D-plattegrond valt terug op de afbeelding`, async ({ page }) => {
    await open(page, `case=${kind}&rol=eigenaar`);
    await expect(detail(page).locator(IMAGE).first()).toBeVisible();
    await expect(viewer(page)).toHaveCount(0);
    await expect(detail(page).getByRole("link", { name: "Vervang door 3D-plattegrond" })).toBeVisible();
  });
}

test("na het opslaan van een 3D-plattegrond schakelt de weergave van afbeelding naar 3D", async ({ page }) => {
  // Zelfde activiteit, twee toestanden: vóór (alleen afbeelding) en ná het opslaan in de editor (3D-plattegrond gekoppeld).
  await open(page, "case=afbeelding&rol=eigenaar");
  await expect(detail(page).locator(IMAGE).first()).toBeVisible();
  await open(page, "case=beide&rol=eigenaar");
  await expect(viewer(page)).toHaveCount(1);
  await expect(page.locator(IMAGE)).toHaveCount(0);
});

test("de oude 2D-deeplink redirect permanent naar de 3D-editor, met behoud van het activiteit-id", async ({ request }) => {
  const plain = await request.get("/les-maken?tab=voorbereiding", { maxRedirects: 0 });
  expect([301, 308]).toContain(plain.status());
  // Next geeft overige query-parameters door (behoud van parameters); het pad is de 3D-editor.
  const plainLocation = new URL(plain.headers()["location"], "http://x");
  expect(plainLocation.pathname).toBe("/plattegrond-3d");
  expect(plainLocation.searchParams.get("activiteit")).toBeNull();

  const withActivity = await request.get(`/les-maken?tab=voorbereiding&vanuit=${ACTIVITY_ID}`, { maxRedirects: 0 });
  expect([301, 308]).toContain(withActivity.status());
  const location = new URL(withActivity.headers()["location"], "http://x");
  expect(location.pathname).toBe("/plattegrond-3d");
  expect(location.searchParams.get("activiteit")).toBe(ACTIVITY_ID);

  // De gewone wizard-route blijft bestaan (geen permanente redirect).
  const wizard = await request.get("/les-maken", { maxRedirects: 0 });
  expect([301, 308]).not.toContain(wizard.status());
});
