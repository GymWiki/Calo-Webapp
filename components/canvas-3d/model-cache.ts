import { useGLTF } from "@react-three/drei";
import type * as THREE from "three";

// GPU-geheugen opruimen voor modellen die niet meer op de plattegrond staan.
//
// drei's `useGLTF` houdt elk geladen model eeuwig in zijn cache, en three geeft de GPU-resources
// (geometrie, textures) pas vrij als er expliciet `.dispose()` op wordt aangeroepen. Op iOS Safari
// (strakke geheugenlimiet) loopt dat op na veel verschillende items. `releaseModel` ruimt één model
// op; de editor roept het aan 30 s nadat het laatste exemplaar van een model is verwijderd
// (ruim genoeg voor "ongedaan maken"), en `releaseAllModels` bij het sluiten van de editor.

const scenes = new Map<string, THREE.Object3D>();

/** Onthoudt de geladen scene per URL, zodat we hem later kunnen opruimen. */
export function trackModelScene(url: string, scene: THREE.Object3D): void {
  scenes.set(url, scene);
}

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value && (value as THREE.Texture).isTexture) (value as THREE.Texture).dispose();
  }
  material.dispose();
}

export function releaseModel(url: string): void {
  const scene = scenes.get(url);
  if (scene) {
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) mesh.material.forEach(disposeMaterial);
      else if (mesh.material) disposeMaterial(mesh.material);
    });
    scenes.delete(url);
  }
  useGLTF.clear(url);
}

export function releaseAllModels(): void {
  for (const url of [...scenes.keys()]) releaseModel(url);
}

export function trackedModelCount(): number {
  return scenes.size;
}
