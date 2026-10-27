"use client";

import { useCallback, useState } from "react";

import { QUALITY_SETTINGS, type QualitySetting } from "@/components/canvas-3d/mobile/mobile-logic";

const KEY = "gymwiki.editor.settings.v1";

export type EditorSettings = {
  quality: QualitySetting;
  /** Bibliotheek sluit na het plaatsen van een item (anders blijft hij open voor meer items). */
  closeLibraryAfterPlace: boolean;
};

const DEFAULTS: EditorSettings = { quality: "auto", closeLibraryAfterPlace: true };

function read(): EditorSettings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<EditorSettings>;
    return {
      quality: QUALITY_SETTINGS.includes(parsed.quality as QualitySetting) ? (parsed.quality as QualitySetting) : DEFAULTS.quality,
      closeLibraryAfterPlace: typeof parsed.closeLibraryAfterPlace === "boolean" ? parsed.closeLibraryAfterPlace : DEFAULTS.closeLibraryAfterPlace,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Instellingen van de editor (kwaliteit, bibliotheekgedrag), bewaard in localStorage. */
export function useEditorSettings() {
  const [settings, setSettings] = useState<EditorSettings>(read);

  const update = useCallback((patch: Partial<EditorSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // privémodus: instelling geldt dan alleen voor deze sessie
      }
      return next;
    });
  }, []);

  return { settings, update };
}
