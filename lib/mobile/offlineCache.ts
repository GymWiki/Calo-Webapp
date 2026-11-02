// Lichte "recent bekeken"-lijst voor de native app. Wordt getoond op het
// offline-scherm (www/offline.html, Capacitor `server.errorPath`) als de
// live site niet bereikbaar is. Bewust klein: titels + link, geen volledige
// inhoud — volledige offline-inhoud is geen onderdeel van deze release.
// Opslag via @capacitor/preferences (native), key RECENT_KEY.

export const RECENT_KEY = "gymwiki.recent";
const MAX = 10;

export interface RecentActivity {
  id: string;
  title: string;
}

export function mergeRecent(list: RecentActivity[], next: RecentActivity, max = MAX): RecentActivity[] {
  return [next, ...list.filter((item) => item.id !== next.id)].slice(0, max);
}

export async function rememberActivity(item: RecentActivity): Promise<void> {
  if (typeof window === "undefined" || !("Capacitor" in window)) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: RECENT_KEY });
    const list: RecentActivity[] = value ? JSON.parse(value) : [];
    await Preferences.set({ key: RECENT_KEY, value: JSON.stringify(mergeRecent(Array.isArray(list) ? list : [], item)) });
  } catch {
    // Cache is een extraatje; nooit een foutmelding.
  }
}
