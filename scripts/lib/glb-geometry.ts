// Leest uit een GLB de ZICHTBARE geometrie per mesh-node (vertices in de ruimte van het item, kleuren) en de lege
// `anchor_<type>_<naam>`-nodes. Gedeeld door scripts/audit-anchors.ts en de anchor-generator; geen netwerk, geen schrijfacties.

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

export type Vec3 = [number, number, number];

export type GlbPart = {
  name: string;
  /** Basiskleur (0–1 RGBA) van het eerste materiaal, of null. */
  color: [number, number, number, number] | null;
  /** Vertices in de ruimte van het item (x,y,z na elkaar). */
  positions: Float32Array;
  /** Driehoeken als indexen in `positions` (3 per driehoek, vertexnummers). */
  triangles: Uint32Array;
  min: Vec3;
  max: Vec3;
};

export type GlbAnchorNode = {
  name: string;
  position: Vec3;
  /** De lokale +Y-as van de lege node in de ruimte van het item (genormaliseerd): de richting waarin het touw het object verlaat. */
  direction: Vec3;
};

export type GlbGeometry = { parts: GlbPart[]; anchorNodes: GlbAnchorNode[]; nodeNames: string[] };

type Mat = number[];
const IDENTITY: Mat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function multiply(a: Mat, b: Mat): Mat {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}

let ioPromise: Promise<NodeIO> | null = null;
async function getIo(): Promise<NodeIO> {
  ioPromise ??= (async () => {
    await MeshoptDecoder.ready;
    return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  })();
  return ioPromise;
}

export const ANCHOR_NODE_PATTERN = /^anchor_([a-z]+)_([a-z0-9_]+?)(?:_\d+)?$/i;

export async function readGlbGeometry(glb: Uint8Array): Promise<GlbGeometry> {
  const document = await (await getIo()).readBinary(glb);
  const scene = document.getRoot().listScenes()[0];
  const parts: GlbPart[] = [];
  const anchorNodes: GlbAnchorNode[] = [];
  const nodeNames: string[] = [];

  const visit = (node: ReturnType<typeof scene.listChildren>[number], parent: Mat) => {
    const world = multiply(parent, node.getMatrix() as Mat);
    const name = node.getName();
    nodeNames.push(name);
    const mesh = node.getMesh();
    if (mesh) {
      const chunks: number[] = [];
      const tris: number[] = [];
      const min: Vec3 = [Infinity, Infinity, Infinity];
      const max: Vec3 = [-Infinity, -Infinity, -Infinity];
      let color: GlbPart["color"] = null;
      const vertex = [0, 0, 0];
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute("POSITION");
        if (!position) continue;
        color ??= (primitive.getMaterial()?.getBaseColorFactor() as GlbPart["color"]) ?? null;
        const base = chunks.length / 3;
        const indices = primitive.getIndices();
        const mode = primitive.getMode();
        if (mode === 4) {
          const count = indices ? indices.getCount() : position.getCount();
          for (let i = 0; i + 2 < count; i += 3) {
            tris.push(base + (indices ? indices.getScalar(i) : i), base + (indices ? indices.getScalar(i + 1) : i + 1), base + (indices ? indices.getScalar(i + 2) : i + 2));
          }
        }
        for (let i = 0; i < position.getCount(); i++) {
          position.getElement(i, vertex);
          const x = world[0] * vertex[0] + world[4] * vertex[1] + world[8] * vertex[2] + world[12];
          const y = world[1] * vertex[0] + world[5] * vertex[1] + world[9] * vertex[2] + world[13];
          const z = world[2] * vertex[0] + world[6] * vertex[1] + world[10] * vertex[2] + world[14];
          chunks.push(x, y, z);
          min[0] = Math.min(min[0], x); min[1] = Math.min(min[1], y); min[2] = Math.min(min[2], z);
          max[0] = Math.max(max[0], x); max[1] = Math.max(max[1], y); max[2] = Math.max(max[2], z);
        }
      }
      if (chunks.length) parts.push({ name, color, positions: Float32Array.from(chunks), triangles: Uint32Array.from(tris), min, max });
    } else if (/^anchor_/i.test(name)) {
      const up: Vec3 = [world[4], world[5], world[6]];
      const length = Math.hypot(...up) || 1;
      anchorNodes.push({ name, position: [world[12], world[13], world[14]], direction: [up[0] / length, up[1] / length, up[2] / length] });
    }
    for (const child of node.listChildren()) visit(child, world);
  };
  for (const node of scene.listChildren()) visit(node, IDENTITY);
  return { parts, anchorNodes, nodeNames };
}
