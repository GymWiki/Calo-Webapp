"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

export type SceneAuditResult = { shadowMapEnabled: boolean; castShadow: number; receiveShadow: number; shadowLights: number; shadowNamedMeshes: number; drawCalls: number; triangles: number };

declare global {
  interface Window {
    __sceneAudit?: () => SceneAuditResult;
  }
}

/** Alleen op /e2e-routes: laat tests de scene inspecteren (geen schaduwen) en draw calls meten. Zonder effect in productie. */
export function SceneAudit() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
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
    return () => {
      delete window.__sceneAudit;
    };
  }, [gl, scene, invalidate]);
  return null;
}
