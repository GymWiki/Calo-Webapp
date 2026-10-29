// Rendert per pose een transparante thumbnail (480×360 PNG) met three.js in headless Chromium — dezelfde belichting voor elke pose.
// Gebruikt Playwright (devDependency); in de cloud-sandbox: PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium.

import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const PAGE = `<!doctype html><body style="margin:0;background:transparent"><canvas id="c" width="480" height="360"></canvas>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/","meshopt":"/meshopt/meshopt_decoder.mjs"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshopt";
const id = new URLSearchParams(location.search).get("id");
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f98, 2.2));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 4, 4); scene.add(key);
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
loader.load("/glb/" + id + ".glb", (gltf) => {
  scene.add(gltf.scene);
  const box = new THREE.Box3().setFromObject(gltf.scene); const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3());
  const camera = new THREE.PerspectiveCamera(28, 480 / 360, 0.1, 50);
  const fit = Math.max(size.y, Math.hypot(size.x, size.z) * 0.75) * 1.25;
  const dist = fit / (2 * Math.tan(THREE.MathUtils.degToRad(14)));
  camera.position.set(center.x + dist * 0.35, center.y + size.y * 0.05, center.z + dist);
  camera.lookAt(center);
  renderer.render(scene, camera);
  document.title = "done";
}, undefined, (e) => { document.title = "error " + e; });
</script>`;

export async function renderThumbnails(dir: string, ids: string[]): Promise<void> {
  const server = http.createServer(async (req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    try {
      let file: string;
      if (url === "/") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(PAGE);
        return;
      } else if (url.startsWith("/three/")) file = path.join("node_modules", url);
      else if (url.startsWith("/meshopt/")) file = path.join("node_modules/meshoptimizer", url.replace("/meshopt/", ""));
      else if (url.startsWith("/glb/")) file = path.join(dir, url.replace("/glb/", ""));
      else throw new Error("onbekend pad");
      const data = await readFile(file);
      res.writeHead(200, { "content-type": /\.m?js$/.test(file) ? "text/javascript" : "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
  });
  try {
    for (const id of ids) {
      const page = await browser.newPage({ viewport: { width: 480, height: 360 } });
      page.on("pageerror", (e) => console.warn("pagina-fout", e.message));
      await page.goto(`http://localhost:${port}/?id=${id}`);
      await page.waitForFunction(() => document.title !== "", null, { timeout: 30_000 });
      const title = await page.title();
      if (title !== "done") throw new Error(`thumbnail ${id}: ${title}`);
      const png = await page.locator("canvas").screenshot({ omitBackground: true });
      await writeFile(path.join(dir, `${id}.png`), png);
      await page.close();
      console.log(`thumbnail ${id}.png`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}
