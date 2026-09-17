import type { KnowledgeMatch } from "@/types/knowledge";

type CacheEntry = { matches: KnowledgeMatch[]; expiresAt: number };

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minuten
const cache = new Map<string, CacheEntry>();

/**
 * Best-effort "prompt caching" hulp voor AI Lescoach (Deel 2, Maatregel 2):
 * de Kennisbank-context verandert niet bij elke Lescoach-aanroep op dezelfde
 * activiteit binnen dezelfde sessie, dus hoeft niet elke keer opnieuw
 * (query-afhankelijk) opgehaald te worden. Dit is een in-memory Map, geen
 * Redis/DB — op Vercel/serverless is dat per-instance en verdwijnt bij een
 * cold start. Dat is bewust oké: het doel is niet "nooit meer ophalen", maar
 * de gebruikte fragmenten BYTE-IDENTIEK houden tussen herhaalde aanroepen op
 * dezelfde activiteit binnen één (warme) sessie, zodat OpenAI's eigen
 * automatische prompt-prefix-caching (identieke system-prompt-prefix)
 * daadwerkelijk een cache-hit oplevert i.p.v. bij elke aanroep een net iets
 * andere fragmenten-selectie te krijgen (waardoor de hele prefix opnieuw als
 * volledige input gefactureerd wordt).
 */
export function getCachedKnowledgeContext(key: string): KnowledgeMatch[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.matches;
}

export function setCachedKnowledgeContext(key: string, matches: KnowledgeMatch[]): void {
  cache.set(key, { matches, expiresAt: Date.now() + CACHE_TTL_MS });

  // Simpele opruiming tegen ongebonden groei — geen aparte cron nodig voor
  // een cache die per warme instance toch al maar een handvol entries heeft.
  if (cache.size > 500) {
    const now = Date.now();
    for (const [existingKey, existingEntry] of cache) {
      if (existingEntry.expiresAt < now) cache.delete(existingKey);
    }
  }
}

/**
 * Sleutel primair op activityId (de stabielste "zelfde activiteit, zelfde
 * sessie"-signaal) — pas terugvallen op de queryttekst zelf voor een nog
 * niet opgeslagen (nieuwe) activiteit zonder id.
 */
export function buildKnowledgeContextCacheKey(
  userId: string,
  activityId: string | undefined,
  query: string,
): string {
  return activityId ? `${userId}:activity:${activityId}` : `${userId}:query:${query}`;
}
