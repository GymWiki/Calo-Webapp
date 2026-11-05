"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

export type SceneBenchmark = { msPerFrame: number; fps: number; drawCalls: number; triangles: number };
export type SceneAuditResult = { shadowMapEnabled: boolean; castShadow: number; receiveShadow: number; shadowLights: number; shadowNamedMeshes: number; drawCalls: number; triangles: number };

declare global {
  interface Window {
    __sceneAudit?: () => SceneAuditResult;
    __sceneBenchmark?: (frames?: number) => SceneBenchmark;
  }
}

/** Alleen op /e2e-routes: laat tests de scene inspecteren (geen schaduwen) en draw calls meten. Zonder effect in productie. */
export function SceneAudit() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!window.location.pathname.startsWith("/e2e")) return;
    window.__sceneAudit = () => {
      invalidate();
      let castShadow = 0;
      let receiveShadow = 0;
      let shadowLights = 0;
      let shadowNamedMeshes = 0;
      scene.traverse((object) => {
        if (object.castShadow) castShadow += 1;
        if (object.receiveShadow) receiveShadow += 1;
        if ((object as THREE.Light).isLight && (object as THREE.Light).castShadow) shadowLights += 1;
        if ((object as THREE.Mesh).isMesh && /shadow|schaduw|blob/i.test(object.name)) shadowNamedMeshes += 1;
      });
      return { shadowMapEnabled: gl.shadowMap.enabled, castShadow, receiveShadow, shadowLights, shadowNamedMeshes, drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles };
    };
    // Meet de kale rendertijd (zonder rAF-begrenzing): N keer renderen en middelen.
    window.__sceneBenchmark = (frames = 120) => {
      gl.render(scene, camera);
      const start = performance.now();
      for (let index = 0; index < frames; index += 1) gl.render(scene, camera);
      gl.getContext().finish();
      const msPerFrame = (performance.now() - start) / frames;
      return { msPerFrame, fps: 1000 / msPerFrame, drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles };
    };
    return () => {
      delete window.__sceneAudit;
      delete window.__sceneBenchmark;
    };
  }, [gl, scene, camera, invalidate]);
  return null;
}
