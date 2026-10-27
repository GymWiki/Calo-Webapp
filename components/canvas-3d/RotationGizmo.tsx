"use client";

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { AXIS_COLOR, AXIS_LABEL, angleDelta, type RotationAxis } from "@/components/canvas-3d/rotation-controls";
import type { Rotation3, Vec3 } from "@/components/canvas-3d/orientation";

const MIN_RING_PX = 64; // de ringen blijven minstens zo groot op het scherm, ook bij uitgezoomd beeld
const RING_PADDING = 1.15;
const DEG = Math.PI / 180;

const BASIS: Record<RotationAxis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

/** Een torus ligt standaard in het XY-vlak (normaal = Z); dit draait hem naar de gewenste as. */
const RING_ROTATION: Record<RotationAxis, [number, number, number]> = {
  x: [0, Math.PI / 2, 0],
  y: [Math.PI / 2, 0, 0],
  z: [0, 0, 0],
};

type DragState = {
  axis: RotationAxis;
  plane: THREE.Plane;
  center: THREE.Vector3;
  a: THREE.Vector3;
  b: THREE.Vector3;
  startAngle: number;
  free: boolean;
};

/**
 * Drie ringen om het geselecteerde item: groen = draaien (Y), rood = voor/achter (X), blauw =
 * zijwaarts (Z). Alleen met muis (de aanroeper verbergt hem op touch). Slepen berekent de hoek in het
 * vlak van de ring (ray ∩ vlak) en meldt het totale verschil sinds het begin; de aanroeper rekent dat
 * om naar een rotatie (met snapping, wereld/lokaal). Shift = vrij draaien (geen snapping).
 */
export function RotationGizmo({
  center,
  radius,
  rotation,
  local,
  axes,
  onStart,
  onDrag,
  onEnd,
}: {
  /** Wereldpositie van het midden van het item. */
  center: Vec3;
  /** Halve diagonaal van het item (m): ondergrens voor de ringstraal. */
  radius: number;
  rotation: Rotation3;
  /** Ringen volgen de assen van het item i.p.v. de assen van de zaal. */
  local: boolean;
  axes: RotationAxis[];
  onStart: (axis: RotationAxis) => void;
  onDrag: (axis: RotationAxis, deltaDeg: number, free: boolean) => void;
  onEnd: () => void;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const raycasterRef = useRef(new THREE.Raycaster());
  const groupRef = useRef<THREE.Group>(null);
  const dragRef = useRef<DragState | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [hover, setHover] = useState<RotationAxis | null>(null);
  const [active, setActive] = useState<RotationAxis | null>(null);
  // Tijdens het slepen blijven positie en stand van de ringen vast: het item beweegt, de ring wacht.
  const [frozen, setFrozen] = useState<{ center: Vec3; quaternion: THREE.Quaternion } | null>(null);

  const liveQuaternion = useMemo(
    () => (local ? new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x * DEG, rotation.y * DEG, rotation.z * DEG, "YXZ")) : new THREE.Quaternion()),
    [local, rotation.x, rotation.y, rotation.z],
  );
  const shownCenter = frozen?.center ?? center;
  const shownQuaternion = frozen?.quaternion ?? liveQuaternion;

  const handlersRef = useRef({ onDrag, onEnd });
  useEffect(() => {
    handlersRef.current = { onDrag, onEnd };
  });
  useEffect(() => () => cleanupRef.current?.(), []);

  // Constante schermgrootte: schaal de eenheidsringen elk frame naar de gewenste wereldstraal.
  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const target = new THREE.Vector3(...shownCenter);
    const height = gl.domElement.clientHeight || 1;
    let worldPerPx: number;
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      worldPerPx = 1 / (camera as THREE.OrthographicCamera).zoom;
    } else {
      const fov = ((camera as THREE.PerspectiveCamera).fov ?? 50) * DEG;
      worldPerPx = (2 * camera.position.distanceTo(target) * Math.tan(fov / 2)) / height;
    }
    group.scale.setScalar(Math.max(radius * RING_PADDING, MIN_RING_PX * worldPerPx));
  });

  function pointOnPlane(clientX: number, clientY: number, plane: THREE.Plane): THREE.Vector3 | null {
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycasterRef.current.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    return raycasterRef.current.ray.intersectPlane(plane, hit);
  }

  function angleOf(point: THREE.Vector3, drag: Pick<DragState, "center" | "a" | "b">): number {
    const v = point.clone().sub(drag.center);
    return Math.atan2(v.dot(drag.b), v.dot(drag.a)) / DEG;
  }

  function begin(axis: RotationAxis, event: ThreeEvent<PointerEvent>) {
    if (event.nativeEvent.button !== 0) return;
    event.stopPropagation();
    const quaternion = shownQuaternion.clone();
    const normal = BASIS[axis].clone().applyQuaternion(quaternion).normalize();
    const centerVec = new THREE.Vector3(...center);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, centerVec);
    const helper = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const a = helper.clone().cross(normal).normalize();
    const b = normal.clone().cross(a).normalize();
    const point = pointOnPlane(event.nativeEvent.clientX, event.nativeEvent.clientY, plane);
    if (!point) return;
    const drag: DragState = { axis, plane, center: centerVec, a, b, startAngle: angleOf(point, { center: centerVec, a, b }), free: event.nativeEvent.shiftKey };
    dragRef.current = drag;
    setFrozen({ center: [...center], quaternion });
    setActive(axis);
    onStart(axis);

    const move = (nativeEvent: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      const hit = pointOnPlane(nativeEvent.clientX, nativeEvent.clientY, current.plane);
      if (!hit) return;
      handlersRef.current.onDrag(current.axis, angleDelta(current.startAngle, angleOf(hit, current)), nativeEvent.shiftKey);
    };
    const finish = () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      dragRef.current = null;
      setActive(null);
      setFrozen(null);
      gl.domElement.style.cursor = "";
      handlersRef.current.onEnd();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }

  return (
    <group position={shownCenter} quaternion={shownQuaternion} renderOrder={999}>
      <group ref={groupRef}>
        {axes.map((axis) => {
          const highlighted = hover === axis || active === axis;
          return (
            <group key={axis} rotation={RING_ROTATION[axis]}>
              {/* Zichtbare ring: altijd bovenop (depthTest uit), dikker bij hover/actief. */}
              <mesh renderOrder={999} raycast={() => null}>
                <torusGeometry args={[1, highlighted ? 0.045 : 0.025, 8, 72]} />
                <meshBasicMaterial color={AXIS_COLOR[axis]} depthTest={false} transparent opacity={highlighted ? 1 : 0.8} toneMapped={false} />
              </mesh>
              {/* Onzichtbare, dikkere raakzone zodat de ring makkelijk te pakken is. */}
              <mesh
                name={`rotatie-ring-${axis}`}
                userData={{ title: AXIS_LABEL[axis] }}
                visible={false}
                onPointerOver={(event) => {
                  event.stopPropagation();
                  setHover(axis);
                  gl.domElement.style.cursor = "grab";
                }}
                onPointerOut={() => {
                  setHover((current) => (current === axis ? null : current));
                  if (!dragRef.current) gl.domElement.style.cursor = "";
                }}
                onPointerDown={(event) => begin(axis, event)}
              >
                <torusGeometry args={[1, 0.14, 6, 48]} />
                <meshBasicMaterial />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}
