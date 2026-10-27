// Prestatiemeting van de 3D-editor op "mobiel" (emulatie + CPU-throttling).
//   node e2e/perf-mobile.mjs --url=http://localhost:3123/dev-editor?n=30 --label=voor [--device="iPhone 14"] [--cpu=4] [--out=docs/mobile-perf-voor.json]
// Meet: tijd tot eerste frame, aantal gerenderde frames/s tijdens een camera-rondje,
// draw calls per frame en JS-heap. Frames en draw calls worden geteld door de WebGL-aanroepen
// te tellen (clear = één R3F-frame), zodat dit ook werkt met frameloop="demand".
// LET OP: headless Chromium gebruikt software-WebGL (SwiftShader); absolute FPS-cijfers zijn dus
// pessimistisch en alleen bruikbaar om voor/na te vergelijken, niet als echt toestelgetal.
import { chromium, devices } from "@playwright/test";
import { writeFileSync } from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, "").split("="); return [k, v.join("=") || true]; }));
const url = args.url ?? "http://localhost:3123/dev-editor?n=30";
const deviceName = args.device ?? "iPhone 14";
const cpu = Number(args.cpu ?? 4);
const label = args.label ?? "meting";
const runs = Number(args.runs ?? 2);

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (process.env.PLAYWRIGHT_BROWSERS_PATH ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium` : undefined),
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});

async function once() {
  const context = await browser.newContext({ ...devices[deviceName], defaultBrowserType: undefined });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const stats = { clears: 0, draws: 0, firstClearAt: 0, instanced: 0 };
    window.__gl = stats;
    for (const Ctx of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
      if (!Ctx) continue;
      const proto = Ctx.prototype;
      const wrap = (name, fn) => { const orig = proto[name]; proto[name] = function (...a) { fn(); return orig.apply(this, a); }; };
      wrap("clear", () => { stats.clears++; if (!stats.firstClearAt) stats.firstClearAt = performance.now(); });
      for (const n of ["drawElements", "drawArrays"]) wrap(n, () => { stats.draws++; });
      for (const n of ["drawElementsInstanced", "drawArraysInstanced"]) wrap(n, () => { stats.draws++; stats.instanced++; });
    }
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("canvas") && window.__gl.clears >= 1 && window.__gl.draws > 200, null, { timeout: 120000 }).catch(async (e) => { console.error("wacht-fout", JSON.stringify(await page.evaluate(() => ({ gl: window.__gl, canvases: document.querySelectorAll("canvas").length, body: document.body.innerText.slice(0, 80) })))); throw e; });
  // wacht tot de scene (zaal + items) stabiel is: geen nieuwe frames meer gedurende 1,5 s
  let last = -1, stableSince = Date.now();
  while (Date.now() - stableSince < 1500) {
    const c = await page.evaluate(() => window.__gl.clears);
    if (c !== last) { last = c; stableSince = Date.now(); }
    await page.waitForTimeout(150);
  }
  const loadMs = stableSince - t0;
  const heapAfterLoad = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null));

  // camera-rondje: 3 s slepen met één vinger/muis op het canvas
  const box = await page.locator("canvas").first().boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2, r = Math.min(box.width, box.height) / 4;
  const before = await page.evaluate(() => ({ ...window.__gl }));
  const start = Date.now();
  await page.mouse.move(cx, cy - r);
  await page.mouse.down();
  let i = 0;
  while (Date.now() - start < 3000) {
    const a = (i++ / 40) * Math.PI * 2;
    await page.mouse.move(cx + r * Math.sin(a), cy - r * Math.cos(a));
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  const elapsed = (Date.now() - start) / 1000;
  const after = await page.evaluate(() => ({ ...window.__gl }));
  const frames = after.clears - before.clears;
  const draws = after.draws - before.draws;
  const heapEnd = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null));
  await context.close();
  return { loadMs, fps: +(frames / elapsed).toFixed(1), drawCallsPerFrame: frames ? Math.round(draws / frames) : null, frames, heapAfterLoadMB: heapAfterLoad && +heapAfterLoad.toFixed(0), heapEndMB: heapEnd && +heapEnd.toFixed(0) };
}

const results = [];
try {
  for (let n = 0; n < runs; n++) results.push(await once());
} finally {
  await browser.close();
}
const med = (key) => { const v = results.map((r) => r[key]).filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
const summary = { label, url, device: deviceName, cpuThrottle: cpu, runs: results, median: { loadMs: med("loadMs"), fps: med("fps"), drawCallsPerFrame: med("drawCallsPerFrame"), heapAfterLoadMB: med("heapAfterLoadMB"), heapEndMB: med("heapEndMB") } };
console.log(JSON.stringify(summary.median), "runs:", results.map((r) => `${r.fps}fps/${r.loadMs}ms`).join(" "));
if (args.out) writeFileSync(args.out, JSON.stringify(summary, null, 1));
