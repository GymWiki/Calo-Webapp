"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { listModelFavorites, setModelFavorite } from "@/actions/libraryFavorites";

// Voorkeuren van de itembibliotheek: favorieten, recent gebruikt en weergave.
// Alles staat direct in localStorage (instant, ook offline of zonder migratie);
// favorieten worden daarnaast best-effort met Supabase gesynchroniseerd zodat
// ze op elk apparaat meekomen. Een fout van Supabase wordt genegeerd.

const FAVORITES_KEY = "gymwiki.library.favorites";
const RECENT_KEY = "gymwiki.library.recent";
const VIEW_KEY = "gymwiki.library.view";
export const RECENT_LIMIT = 8;

export type LibraryView = "grid" | "list";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // privémodus of vol: voorkeur gaat dan alleen verloren, niets breekt
  }
}

/** `syncServer: false` (gastmodus, geen account): favorieten blijven lokaal, er gaan geen serveracties af. */
export function useLibraryPrefs({ syncServer = true }: { syncServer?: boolean } = {}) {
  // De bibliotheek leeft in de ssr:false-editor, dus localStorage is bij de
  // eerste render al beschikbaar (readJson valt anders veilig terug).
  const [favorites, setFavorites] = useState<string[]>(() => readJson<string[]>(FAVORITES_KEY, []));
  // Ref zodat toggleFavorite zonder neveneffecten in een state-updater kan lezen.
  const favoritesRef = useRef<string[]>(favorites);
  const [recent, setRecent] = useState<string[]>(() => readJson<string[]>(RECENT_KEY, []));
  const [view, setViewState] = useState<LibraryView>(() => (readJson<LibraryView>(VIEW_KEY, "grid") === "list" ? "list" : "grid"));

  useEffect(() => {
    if (!syncServer) return;
    // Aanvullen vanuit Supabase (best effort): favorieten van andere apparaten.
    let cancelled = false;
    void listModelFavorites()
      .then((result) => {
        if (cancelled || !("success" in result)) return;
        const local = favoritesRef.current;
        const merged = [...new Set([...local, ...result.slugs])];
        favoritesRef.current = merged;
        setFavorites(merged);
        writeJson(FAVORITES_KEY, merged);
        // Lokale favorieten die nog niet op de server staan alsnog wegschrijven.
        for (const slug of local) {
          if (!result.slugs.includes(slug)) void setModelFavorite(slug, true).catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [syncServer]);

  const toggleFavorite = useCallback((slug: string) => {
    const current = favoritesRef.current;
    const on = !current.includes(slug);
    const next = on ? [slug, ...current] : current.filter((entry) => entry !== slug);
    favoritesRef.current = next;
    setFavorites(next);
    writeJson(FAVORITES_KEY, next);
    if (syncServer) void setModelFavorite(slug, on).catch(() => {});
  }, [syncServer]);

  const pushRecent = useCallback((slug: string) => {
    setRecent((current) => {
      const next = [slug, ...current.filter((entry) => entry !== slug)].slice(0, RECENT_LIMIT);
      writeJson(RECENT_KEY, next);
      return next;
    });
  }, []);

  const setView = useCallback((next: LibraryView) => {
    setViewState(next);
    writeJson(VIEW_KEY, next);
  }, []);

  return { favorites, recent, view, toggleFavorite, pushRecent, setView };
}
