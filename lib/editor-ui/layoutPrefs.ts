// Indeling-instellingen van de 3D-editor, onthouden in één localStorage-object met versienummer en veilige fallback
// (geen database nodig). Puur: de lees- en schrijf-aanroepen zitten in useEditorUiPrefs.

export const UI_PREFS_KEY = "gymwiki.editor.ui";
export const UI_PREFS_VERSION = 1;

export type ToolbarPosition = "bottom" | "top" | "hidden";
export const TOOLBAR_POSITIONS: readonly ToolbarPosition[] = ["bottom", "top", "hidden"];

export type EditorUiPrefs = {
  version: typeof UI_PREFS_VERSION;
  /** Waar de zwevende canvaswerkbalk staat (desktop). */
  toolbar: ToolbarPosition;
  /** Feature flags per onderdeel: uitzetten draait dat onderdeel terug naar de oude indeling. */
  flags: { canvasToolbar: boolean };
};

export const DEFAULT_UI_PREFS: EditorUiPrefs = { version: UI_PREFS_VERSION, toolbar: "bottom", flags: { canvasToolbar: true } };

/** Leest opgeslagen instellingen; alles wat ontbreekt, kapot of van een andere versie is valt terug op de standaard. */
export function parseUiPrefs(raw: string | null | undefined): EditorUiPrefs {
  if (!raw) return DEFAULT_UI_PREFS;
  try {
    const value = JSON.parse(raw) as Partial<EditorUiPrefs> | null;
    if (!value || typeof value !== "object" || value.version !== UI_PREFS_VERSION) return DEFAULT_UI_PREFS;
    const toolbar = TOOLBAR_POSITIONS.includes(value.toolbar as ToolbarPosition) ? (value.toolbar as ToolbarPosition) : DEFAULT_UI_PREFS.toolbar;
    const canvasToolbar = typeof value.flags?.canvasToolbar === "boolean" ? value.flags.canvasToolbar : DEFAULT_UI_PREFS.flags.canvasToolbar;
    return { version: UI_PREFS_VERSION, toolbar, flags: { canvasToolbar } };
  } catch {
    return DEFAULT_UI_PREFS;
  }
}

export function serializeUiPrefs(prefs: EditorUiPrefs): string {
  return JSON.stringify(prefs);
}

/** Volgende werkbalkpositie bij het doorlopen van "Onder → Boven → Verborgen". */
export function nextToolbarPosition(position: ToolbarPosition): ToolbarPosition {
  return TOOLBAR_POSITIONS[(TOOLBAR_POSITIONS.indexOf(position) + 1) % TOOLBAR_POSITIONS.length];
}
