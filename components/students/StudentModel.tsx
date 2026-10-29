"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { trackModelScene } from "@/components/canvas-3d/model-cache";
import { cloneStudentScene } from "@/components/students/student-shader";
import { studentScale, type StudentSize } from "@/lib/students/catalog";

/**
 * Eén leerling: de GLB van de pose (gedeeld via drei's cache), geschaald naar klein/middel/groot en met de gekozen shirtkleur.
 * Pivot = onderkant-midden van het lichaam, voorkant +Z (zie scripts/process-students.mts), dus schalen om de oorsprong laat de
 * voeten op de vloer staan.
 */
export function StudentModel({ modelUrl, color, size }: { modelUrl: string; color?: string; size?: StudentSize | string }) {
  const gltf = useGLTF(modelUrl);
  const scene = useMemo(() => cloneStudentScene(gltf.scene, color), [gltf.scene, color]);
  useEffect(() => {
    trackModelScene(modelUrl, gltf.scene);
  }, [modelUrl, gltf.scene]);
  const scale = studentScale(size);
  return <primitive object={scene} scale={[scale, scale, scale]} />;
}
