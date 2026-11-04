import { test } from "@playwright/test";

import { openEditor } from "./helpers";

// Alleen op verzoek: UI_SCREENSHOTS=1 … --project=desktop. Schrijft screenshots naar docs/editor-ui-opschonen/.
const OUT = "docs/editor-ui-opschonen";
for (const vp of [
  { id: "desktop-1366x768", width: 1366, height: 768, touch: false },
  { id: "desktop-1920x1080", width: 1920, height: 1080, touch: false },
  { id: "tablet-820x1180", width: 820, height: 1180, touch: true },
  { id: "mobiel-390x844", width: 390, height: 844, touch: true },
]) {
  test(`screenshot ${vp.id}`, async ({ browser }, testInfo) => {
    test.skip(!process.env.UI_SCREENSHOTS || testInfo.project.name !== "desktop", "alleen op verzoek");
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch && vp.width < 800, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await openEditor(page);
    await page.screenshot({ path: `${OUT}/na-${vp.id}.png` });
    if (vp.width >= 1024) {
      await page.getByRole("button", { name: /^Toestellen/ }).first().scrollIntoViewIfNeeded().catch(() => undefined);
      await page.getByText("Vaste onderdelen").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/na-${vp.id}-vaste-onderdelen.png` });
    }
    await context.close();
  });
}
