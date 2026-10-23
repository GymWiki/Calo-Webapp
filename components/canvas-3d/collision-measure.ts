// Meet de ZICHTBARE geometrie van een geladen model in three.js: alleen
// zichtbare meshes (ook niet via een verborgen parent), vertex-nauwkeurig
// (dus geen world-AABB van gedraaide bounds), met instances en skinned
// meshes. Levert dezelfde MeshExtent als het audit-script (gltf-transform),
// zodat collision-shape.ts er één vorm uit afleidt.

import * as THREE from "three";
import { convexHull, type MeshExtent, type Point } from "@/components/canvas-3d/collision-shape";

const cache = new WeakMap<THREE.Object3D, MeshExtent | null>();

/** Vergeet de gemeten geometrie (bij variantwissel, schaalwijziging of een nieuwe GLB). */
export function invalidateMeasuredExtent(root: THREE.Object3D) {
  cache.delete(root);
}



/**
 * Zichtbare mesh-omtrek van `root` in de ruimte waarin `root` zelf staat
 * (de lokale ruimte van het item); null als er niets te meten valt.
 */
export function measureMeshExtent(root: THREE.Object3D, options: { useCache?: boolean } = {}): MeshExtent | null {
  const useCache = options.useCache ?? true;
  if (useCache && cache.has(root)) return cache.get(root) ?? null;

  root.updateWorldMatrix(true, true);
  const parentInverse = root.parent ? new THREE.Matrix4().copy(root.parent.matrixWorld).invert() : new THREE.Matrix4();
  const acc = { points: [] as Point[], minY: Infinity, maxY: -Infinity };
  const toItem = new THREE.Matrix4();
  const instanceMatrix = new THREE.Matrix4();
  const composed = new THREE.Matrix4();
  const v = new THREE.Vector3();

  root.traverseVisible((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const position = mesh.geometry.getAttribute("position");
    if (!position || position.count === 0) return;

    toItem.multiplyMatrices(parentInverse, mesh.matrixWorld);
    const local: Point[] = [];
    const local3: THREE.Vector3[] = [];

    const collect = (matrix: THREE.Matrix4) => {
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
        // Skinned mesh: de bounding box van de huidige pose i.p.v. de rustpose-vertices.
        const skinned = mesh as THREE.SkinnedMesh;
        skinned.computeBoundingBox();
        const box = skinned.boundingBox;
        if (!box) return;
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) local3.push(v.set(x, y, z).applyMatrix4(matrix).clone());
          }
        }
        return;
      }
      for (let i = 0; i < position.count; i++) {
        local3.push(v.fromBufferAttribute(position, i).applyMatrix4(matrix).clone());
      }
    };

    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      const instanced = mesh as THREE.InstancedMesh;
      for (let i = 0; i < instanced.count; i++) {
        instanced.getMatrixAt(i, instanceMatrix);
        collect(composed.multiplyMatrices(toItem, instanceMatrix));
      }
    } else {
      collect(toItem);
    }

    for (const p of local3) {
      local.push({ x: p.x, z: p.z });
      if (p.y < acc.minY) acc.minY = p.y;
      if (p.y > acc.maxY) acc.maxY = p.y;
    }
    // Per mesh de hull houdt het geheugen klein bij grote modellen.
    acc.points.push(...convexHull(local));
  });

  const extent: MeshExtent | null =
    acc.points.length === 0 || !Number.isFinite(acc.minY) ? null : { hull: convexHull(acc.points), minY: acc.minY, maxY: acc.maxY };
  if (useCache) cache.set(root, extent);
  return extent;
}
