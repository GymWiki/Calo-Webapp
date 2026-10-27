"use client";

import { useSyncExternalStore } from "react";

import { layoutForWidth, type EditorLayout } from "@/components/canvas-3d/mobile/mobile-logic";

function subscribeResize(callback: () => void) {
  window.addEventListener("resize", callback);
  window.addEventListener("orientationchange", callback);
  return () => {
    window.removeEventListener("resize", callback);
    window.removeEventListener("orientationchange", callback);
  };
}

/** Telefoon (< 640 px), tablet (640–1023 px) of desktop (≥ 1024 px) — de editor leeft in een ssr:false-chunk, dus `window` bestaat. */
export function useEditorLayout(): EditorLayout {
  return useSyncExternalStore(
    subscribeResize,
    () => layoutForWidth(window.innerWidth),
    () => "desktop",
  );
}

function subscribeMedia(query: string) {
  return (callback: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", callback);
    return () => media.removeEventListener("change", callback);
  };
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribeMedia(query),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Hoofdinvoer is een vinger (telefoon/tablet) i.p.v. een muis. */
export function useCoarsePointer(): boolean {
  return useMediaQuery("(pointer: coarse)");
}

/** Weinig hoogte (telefoon in landscape): compactere toolbar zonder labels. */
export function useShortViewport(): boolean {
  return useMediaQuery("(max-height: 500px)");
}
