"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import { DEFAULT_UI_PREFS, UI_PREFS_KEY, parseUiPrefs, serializeUiPrefs, type EditorUiPrefs } from "@/lib/editor-ui/layoutPrefs";

/** Indeling-instellingen uit localStorage (alleen na mount, geen hydration-verschil); schrijven mag falen zonder gevolgen. */
export function useEditorUiPrefs() {
  // Server en eerste render: de standaard; daarna de opgeslagen waarde (geen hydration-verschil).
  const stored = useSyncExternalStore(
    () => () => undefined,
    () => {
      try {
        return window.localStorage.getItem(UI_PREFS_KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const [override, setOverride] = useState<EditorUiPrefs | null>(null);
  const prefs = override ?? parseUiPrefs(stored) ?? DEFAULT_UI_PREFS;
  const update = useCallback(
    (change: (previous: EditorUiPrefs) => EditorUiPrefs) => {
      const next = change(prefs);
      setOverride(next);
      try {
        window.localStorage.setItem(UI_PREFS_KEY, serializeUiPrefs(next));
      } catch {
        // negeren
      }
    },
    [prefs],
  );
  const reset = useCallback(() => update(() => DEFAULT_UI_PREFS), [update]);
  return { prefs, update, reset };
}
