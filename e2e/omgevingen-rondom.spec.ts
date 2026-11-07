import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { openEditor } from "./helpers";

// Omgevingen met de omgeving rondom (bestrating, bomen, hagen, gras, meubilair) en de nieuwe schoolbaan. De echte GLB's komen uit omgeving-import/
// (kopie van de Drive) via een netwerkroute, zodat de test niet van de productiebucket afhangt (daar staan pas na de upload de nieuwe versies).
async function serveLocalEnvironments(page: Page) {
  await page.route(/\/environments\/[a-z0-9_]+\.glb/, async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop()!;
    try {
      const body = await readFile(path.join("omgeving-import", name));
      await route.fulfill({ status: 200, contentType: "model/gltf-binary", headers: { "access-control-allow-origin": "*" }, body });
    } catch {
      await route.abort();
    }
  });
}

async function draftEnvironment(page: Page) {
  return page.evaluate(() => (() => { const draft = JSON.parse(window.localStorage.getItem("gymwiki.floorplan3d.draft.nieuw") ?? "{}"); return draft.room?.environment ?? draft.environment ?? null; })()) as Promise<{ type: string; layout?: string; hidden?: string[] } | null>;
}

test("sportveld en schoolbaan: 'Omgeving rondom' aan/uit en de nieuwe indeling kiezen; geen console-errors", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop volstaat");
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await serveLocalEnvironments(page);
  await openEditor(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({ path: "docs/omgevingen/gymzaal.png" });

  await page.getByRole("tab", { name: "Omgeving" }).click();
  await page.getByRole("button", { name: "Atletiekbaan", exact: true }).click();
  await page.getByRole("button", { name: /Schoolbaan/ }).click();
  await expect(page.getByText("Omgeving rondom")).toBeVisible();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "docs/omgevingen/atletiek-school.png" });
  expect(await draftEnvironment(page)).toMatchObject({ type: "atletiekbaan", layout: "school" });

  const hagen = page.getByRole("switch", { name: "Hagen" });
  await expect(hagen).toBeChecked();
  await hagen.click();
  await expect.poll(async () => (await draftEnvironment(page))?.hidden ?? []).toContain("Omgeving_Hagen");
  await page.getByRole("switch", { name: "Bomen en struiken" }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "docs/omgevingen/atletiek-school-zonder-bomen.png" });

  await page.getByRole("button", { name: "Sportveld", exact: true }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "docs/omgevingen/sportveld.png" });
  expect(errors.filter((e) => !/favicon|WebGL|swiftshader|GPU stall|Failed to load resource/i.test(e))).toEqual([]);
});
