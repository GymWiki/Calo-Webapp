// Prestatiemeting: 30 leerlingen met verschillende poses en kleuren in de (gratis) 3D-editor.
//   node e2e/perf-students.mjs --url=http://localhost:3201 [--cpu=4] [--device="iPhone 14"|desktop] [--n=30] [--orbit=4] [--label=…] [--out=pad.json]
// Zaait de lokale kladversie (localStorage) met N leerlingen, start de editor en meet: tijd tot stabiel beeld, frames/s tijdens een
// camera-rondje, draw calls per frame en JS-heap. Net als e2e/perf-mobile.mjs: headless Chromium gebruikt software-WebGL
// (SwiftShader), dus de absolute fps zijn pessimistisch en alleen bruikbaar om te vergelijken (met 0 leerlingen als basis).
// De modellen komen van /dev-students (public/dev-students/students/*.glb, niet in git) via NEXT_PUBLIC_STUDENT_MODELS_BASE_URL.
import { chromium, devices } from "@playwright/test";
import { writeFileSync } from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, "").split("="); return [k, v.join("=") || true]; }));
const base = args.url ?? "http://localhost:3201";
const n = Number(args.n ?? 30);
const cpu = Number(args.cpu ?? 4);
const deviceName = args.device ?? "iPhone 14";
const orbitSeconds = Number(args.orbit ?? 4);
const label = args.label ?? `${n} leerlingen`;
const runs = Number(args.runs ?? 2);

const POSES = ["staand", "hardlopen", "juichen", "startblokken", "hoogspringen", "basketbal_dribbelen", "volleybal_onderhands", "volleybal_bovenhands", "badminton_slaan", "pickleball_klaar", "pickleball_slaan", "hockey", "hockey_sprint", "floorball", "floorball_sprint", "honkbal_slaan", "honkbal_vangen", "trefbal_gooien", "verdedigen"];
const COLORS = [undefined, "#dc2626", "#2563eb", "#facc15", "#16a34a", "#f97316", "#f8fafc", "#171717"];
const SIZES = [undefined, "klein", "groot"];

function draft() {
  const items = Array.from({ length: n }, (_, i) => ({
    id: `perf-${i}`,
    slug: `leerling_pose_${POSES[i % POSES.length]}`,
    x: -9 + (i % 10) * 2,
    y: 0,
    z: -4 + Math.floor(i / 10) * 3,
    rot_y_deg: (i * 47) % 360,
    ...(COLORS[i % COLORS.length] ? { color: COLORS[i % COLORS.length] } : {}),
    ...(SIZES[i % SIZES.length] ? { size: SIZES[i % SIZES.length] } : {}),
  }));
  return { savedAt: Date.now(), naam: "Perf", room: { width_m: 24, length_m: 14, environment: { type: "gymzaal", layout: "standaard", hidden: [] } }, items, coneFields: [] };
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});

async function once() {
  const device = deviceName === "desktop" ? { viewport: { width: 1440, height: 900 } } : devices[deviceName];
  const context = await browser.newContext({ ...device, defaultBrowserType: undefined });
  const page = await context.newPage();
  await page.addInitScript((plan) => {
    try {
      window.localStorage.setItem("gymwiki.editor.onboarding.v1", "1");
      window.localStorage.setItem("gymwiki.floorplan3d.draft.nieuw", JSON.stringify(plan));
    } catch {}
    const stats = { clears: 0, draws: 0, tris: 0 };
    window.__gl = stats;
    for (const Ctx of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
      if (!Ctx) continue;
      const proto = Ctx.prototype;
      const wrap = (name, fn) => { const orig = proto[name]; proto[name] = function (...a) { fn(a); return orig.apply(this, a); }; };
      wrap("clear", () => { stats.clears++; });
      wrap("drawElements", (a) => { stats.draws++; stats.tris += a[1] / 3; });
      wrap("drawArrays", (a) => { stats.draws++; stats.tris += a[2] / 3; });
    }
  }, draft());
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const t0 = Date.now();
  await page.goto(`${base}/gratis-gymzaal-plattegrond-maken`, { waitUntil: "load" });
  await page.getByTestId("start-editor").click();
  await page.waitForFunction(() => document.querySelector("canvas") && window.__gl.clears >= 1, null, { timeout: 180000 });
  // Stabiel = geen nieuwe frames meer gedurende 2 s (alle GLB's zijn dan geladen).
  let last = -1, stableSince = Date.now();
  while (Date.now() - stableSince < 2000) {
    const c = await page.evaluate(() => window.__gl.clears);
    if (c !== last) { last = c; stableSince = Date.now(); }
    await page.waitForTimeout(200);
  }
  const loadMs = stableSince - t0;
  const heapAfterLoad = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null));
  const box = await page.locator("canvas").first().boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2, r = Math.min(box.width, box.height) / 4;
  const before = await page.evaluate(() => ({ ...window.__gl }));
  const start = Date.now();
  await page.mouse.move(cx, cy - r);
  await page.mouse.down();
  let i = 0;
  while (Date.now() - start < orbitSeconds * 1000) {
    const a = (i++ / 40) * Math.PI * 2;
    await page.mouse.move(cx + r * Math.sin(a), cy - r * Math.cos(a));
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  const elapsed = (Date.now() - start) / 1000;
  const after = await page.evaluate(() => ({ ...window.__gl }));
  const frames = after.clears - before.clears;
  const heapEnd = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null));
  await context.close();
  return { loadMs, fps: +(frames / elapsed).toFixed(1), drawCallsPerFrame: frames ? Math.round((after.draws - before.draws) / frames) : null, trianglesPerFrame: frames ? Math.round((after.tris - before.tris) / frames) : null, heapAfterLoadMB: heapAfterLoad && +heapAfterLoad.toFixed(0), heapEndMB: heapEnd && +heapEnd.toFixed(0), errors };
}

const results = [];
for (let r = 0; r < runs; r++) results.push(await once());
const median = (key) => { const v = results.map((x) => x[key]).filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
const summary = { label, n, device: deviceName, cpuThrottle: cpu, runs, loadMs: median("loadMs"), fps: median("fps"), drawCallsPerFrame: median("drawCallsPerFrame"), trianglesPerFrame: median("trianglesPerFrame"), heapAfterLoadMB: median("heapAfterLoadMB"), errors: results.flatMap((x) => x.errors) };
console.log(JSON.stringify(summary, null, 2));
if (args.out) writeFileSync(String(args.out), JSON.stringify({ summary, results }, null, 2) + "\n");
await browser.close();
