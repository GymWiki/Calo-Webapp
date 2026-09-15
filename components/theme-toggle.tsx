"use client";

import { useSyncExternalStore } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// Zelfde module-level listener-Set + useSyncExternalStore-patroon als
// library-search-client.tsx's bron-filter-voorkeur — leest/schrijft een
// browser-only waarde (hier: de "dark"-class op <html>) zonder de
// setState-in-effect-valkuil en zonder hydratie-mismatch (getServerSnapshot
// geeft altijd "licht" terug, zoals de server ook rendert; na hydratie leest
// de client meteen de echte class die het inline script in app/layout.tsx
// al vóór het schilderen zette).
const themeListeners = new Set<() => void>();

function getThemeSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

function getThemeServerSnapshot(): boolean {
  return false;
}

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

function setTheme(next: boolean) {
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem("theme", next ? "dark" : "light");
  } catch {
    // Best-effort — een niet-onthouden voorkeur is geen ramp.
  }
  themeListeners.forEach((listener) => listener());
}

/**
 * Licht/donker-voorkeur — schrijft naar dezelfde "theme"-localStorage-sleutel
 * die het inline script in app/layout.tsx bij het laden leest (voorkomt een
 * flits van het verkeerde thema).
 */
export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div>
        <Label htmlFor="theme-toggle">Donkere modus</Label>
        <p className="text-xs text-muted-foreground">
          Volgt standaard je systeemvoorkeur &mdash; hier zet je &apos;m handmatig aan of uit.
        </p>
      </div>
      <Switch id="theme-toggle" checked={isDark} onCheckedChange={setTheme} />
    </div>
  );
}
