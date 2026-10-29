import * as THREE from "three";

// Shirtkleur van een leerling, op de GPU.
//
// De leerling-modellen hebben één kleurtexture waarin het shirt marineblauw is (tint 0,52–0,72, verzadiging > 0,2) — dezelfde
// regel waarmee de kleurvarianten in Blender zijn gemaakt. Voor een andere kleur vervangt dit shader-stukje precies die pixels
// door de gekozen kleur, met behoud van de schaduw/vouwen (helderheid van het origineel). Huid, haar, broek en schoenen blijven
// ongemoeid. Per (materiaal, kleur) één gedeelde materiaalkopie; de texture en geometrie worden hergebruikt (geen extra laadtijd)
// en alle leerlingen delen één shaderprogramma (customProgramCacheKey), alleen de uniform verschilt.

const CACHE_KEY = "gymwiki-student-shirt-v1";
/** Gemiddelde helderheid (sRGB, 0–1) van het marineblauwe shirt in de texturen: daarmee wordt de schaduw genormaliseerd. */
export const SHIRT_REFERENCE_VALUE = 0.38;

export const SHIRT_FRAGMENT = /* glsl */ `
#ifdef USE_MAP
{
  vec3 sRgb = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
  float mx = max(sRgb.r, max(sRgb.g, sRgb.b));
  float mn = min(sRgb.r, min(sRgb.g, sRgb.b));
  float d = mx - mn;
  float sat = mx > 0.0 ? d / mx : 0.0;
  float hue = 0.0;
  if (d > 0.0001) {
    if (mx == sRgb.r) hue = mod((sRgb.g - sRgb.b) / d, 6.0);
    else if (mx == sRgb.g) hue = (sRgb.b - sRgb.r) / d + 2.0;
    else hue = (sRgb.r - sRgb.g) / d + 4.0;
    hue /= 6.0;
  }
  float shirt = smoothstep(0.50, 0.54, hue) * (1.0 - smoothstep(0.70, 0.74, hue)) * smoothstep(0.15, 0.25, sat);
  vec3 tinted = uShirtColor * clamp(mx / ${SHIRT_REFERENCE_VALUE.toFixed(2)}, 0.0, 1.6);
  diffuseColor.rgb = mix(diffuseColor.rgb, tinted, shirt);
}
#endif
`;

const cache = new WeakMap<THREE.Material, Map<string, THREE.Material>>();

/** Materiaalkopie met de shirtkleur `hex` (#rrggbb). Zelfde (bron, kleur) geeft hetzelfde object terug. */
export function studentMaterial(source: THREE.Material, hex: string): THREE.Material {
  let perColor = cache.get(source);
  if (!perColor) cache.set(source, (perColor = new Map()));
  const key = hex.toLowerCase();
  const existing = perColor.get(key);
  if (existing) return existing;

  const material = source.clone();
  const color = new THREE.Color(key); // sRGB-hex → lineaire werkruimte
  const uniform = { value: color };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uShirtColor = uniform;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uShirtColor;")
      .replace("#include <map_fragment>", `#include <map_fragment>\n${SHIRT_FRAGMENT}`);
  };
  material.customProgramCacheKey = () => CACHE_KEY;
  material.userData.studentShirt = key;
  perColor.set(key, material);
  return material;
}

/** Kloon van een geladen leerling-scene waarvan de materialen de shirtkleur `hex` hebben (zonder hex: de originele). */
export function cloneStudentScene(scene: THREE.Object3D, hex: string | undefined): THREE.Object3D {
  const clone = scene.clone(true);
  if (!hex) return clone;
  clone.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => studentMaterial(m, hex)) : studentMaterial(mesh.material, hex);
  });
  return clone;
}
