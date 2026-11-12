import { readFile } from "node:fs/promises";

import { test } from "@playwright/test";

import { canvasCenter } from "./helpers";

// Hulpmiddel (geen regressietest): maakt screenshots van echte leerling-GLB's met de afgeleide handpunten (?debug=collision) voor docs/grip-audit.md.
// Draai met: GRIP_SHOTS=1 npx playwright test e2e/handpunten-visueel.spec.ts --project=desktop
test.use({ bypassCSP: true });

const POSES = (process.env.GRIP_POSES ?? "standaard,hardlopen,juichen,basketbal_dribbelen,handbal,bal_schieten,discuswerpen,hockey").split(",");

test("handpunten op echte poses", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop" || !process.env.GRIP_SHOTS, "alleen op verzoek");
  test.setTimeout(240_000);
  await page.route("http://e2e.local/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop()!;
    try {
      await route.fulfill({ status: 200, contentType: name.endsWith(".png") ? "image/png" : "model/gltf-binary", headers: { "access-control-allow-origin": "*" }, body: await readFile(`materiaal-import/leerlingen/${name.split("?")[0]}`) });
    } catch {
      await route.abort();
    }
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("gymwiki.editor.onboarding.v1", "1");
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(style);
    });
  });
  await page.setViewportSize({ width: 900, height: 700 });
  for (const pose of POSES) {
    await page.addInitScript((slug) => {
      window.localStorage.setItem("gymwiki.floorplan3d.draft.nieuw", JSON.stringify({ naam: "x", items: [{ id: "s1", slug, x: 0, y: 0, z: 0, rot_y_deg: 0 }], coneFields: [], ropes: [], room: { width_m: 24, length_m: 14 } }));
    }, `leerling_pose_${pose}`);
    await page.goto("/e2e/plattegrond-3d?echt=1&debug=collision", { waitUntil: "load" });
    await page.locator("canvas").first().waitFor({ timeout: 60_000 });
    await page.getByRole("button", { name: "Herstellen", exact: true }).click().catch(() => undefined);
    await page.getByTestId("toon-anchors").locator("input").check().catch(() => undefined);
    await page.waitForTimeout(2500);
    const { x, y } = await canvasCenter(page);
    await page.mouse.move(x, y);
    for (let step = 0; step < 8; step++) {
      await page.mouse.wheel(0, -700);
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `docs/grip-audit/${pose}.png`, clip: { x: 150, y: 80, width: 600, height: 520 } });
  }
});
