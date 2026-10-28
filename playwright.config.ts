import { defineConfig, devices } from "@playwright/test";

// End-to-endtests van de 3D-editor (e2e/*.spec.ts) met mobiele device-emulatie.
//   npm run test:e2e                 (start zelf een dev-server op E2E_PORT, standaard 3124)
// In de cloud-sandbox: PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium (geen download nodig).
// Draait tegen de testroute /e2e/plattegrond-3d (placeholder-modellen, geen login of Supabase nodig).
const port = Number(process.env.E2E_PORT ?? 3124);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

const mobile = (device: keyof typeof devices, extra: Record<string, unknown> = {}) => ({
  ...devices[device],
  defaultBrowserType: "chromium" as const,
  ...extra,
});

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions: { executablePath, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] },
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "iphone-14", use: mobile("iPhone 14") },
    { name: "pixel-7", use: mobile("Pixel 7") },
    { name: "ipad", use: mobile("iPad (gen 7)", { viewport: { width: 820, height: 1180 } }) },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npx next dev --webpack -p ${port}`,
    url: `http://localhost:${port}/e2e/plattegrond-3d`,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      E2E_HARNESS: "1",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "dummy-key",
    },
  },
});
