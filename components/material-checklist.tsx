"use client";

import { useCallback, useSyncExternalStore } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Persoonlijk voorbereidingshulpmiddel voor de activiteit-detailpagina —
 * NIET gekoppeld aan de activiteit-data zelf (die kan door anderen gedeeld/
 * bekeken worden; een vinkje "verzameld" is puur iets voor de docent die nu
 * aan het klaarzetten is). Daarom bewust alleen in localStorage, per
 * browser/toestel, sleutel op activiteit-id + sectie (zie storageKey-prop)
 * zodat Basismateriaal en Regelmateriaal — en verschillende activiteiten —
 * elkaar nooit overschrijven.
 *
 * useSyncExternalStore i.p.v. "lees localStorage in een useEffect en zet
 * state" (zelfde patroon als library-search-client.tsx's zoekfilter-
 * voorkeur): getServerSnapshot geeft altijd een lege checklist terug, zoals
 * de server ook rendert, dus geen hydratie-mismatch — na hydratie leest de
 * client meteen de echte, eerder opgeslagen vinkjes.
 */
type CheckedMap = Record<number, boolean>;

const EMPTY_CHECKED: CheckedMap = {};

const listenersByKey = new Map<string, Set<() => void>>();
const cacheByKey = new Map<string, CheckedMap>();

function readChecked(storageKey: string): CheckedMap {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return EMPTY_CHECKED;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as CheckedMap) : EMPTY_CHECKED;
  } catch {
    return EMPTY_CHECKED;
  }
}

function getCheckedSnapshot(storageKey: string): CheckedMap {
  let cached = cacheByKey.get(storageKey);
  if (cached === undefined) {
    cached = readChecked(storageKey);
    cacheByKey.set(storageKey, cached);
  }
  return cached;
}

function getCheckedServerSnapshot(): CheckedMap {
  return EMPTY_CHECKED;
}

function subscribeChecked(storageKey: string) {
  return (listener: () => void) => {
    let listeners = listenersByKey.get(storageKey);
    if (!listeners) {
      listeners = new Set();
      listenersByKey.set(storageKey, listeners);
    }
    listeners.add(listener);
    return () => listeners!.delete(listener);
  };
}

function writeChecked(storageKey: string, next: CheckedMap) {
  cacheByKey.set(storageKey, next);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Privénavigatie, volle opslag — best-effort, geen kritieke data.
  }
  listenersByKey.get(storageKey)?.forEach((listener) => listener());
}

export function MaterialChecklist({
  items,
  storageKey,
  emptyLabel,
}: {
  items: string[];
  storageKey: string;
  emptyLabel: string;
}) {
  const subscribe = useCallback((listener: () => void) => subscribeChecked(storageKey)(listener), [storageKey]);
  const getSnapshot = useCallback(() => getCheckedSnapshot(storageKey), [storageKey]);
  const checked = useSyncExternalStore(subscribe, getSnapshot, getCheckedServerSnapshot);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const anyChecked = Object.values(checked).some(Boolean);

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {items.map((item, index) => {
          const isChecked = Boolean(checked[index]);
          return (
            <li key={index}>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => writeChecked(storageKey, { ...checked, [index]: !isChecked })}
                  className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-input accent-primary"
                />
                <span
                  className={cn(isChecked ? "text-muted-foreground line-through" : "text-foreground")}
                >
                  {item}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!anyChecked}
        onClick={() => writeChecked(storageKey, EMPTY_CHECKED)}
        className="h-7 px-2 text-xs text-muted-foreground"
      >
        <RotateCcw className="size-3.5" />
        Alles wissen
      </Button>
    </div>
  );
}
