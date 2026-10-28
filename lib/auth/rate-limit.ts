// Eenvoudige rate limit per gebruiker voor schrijfacties van het beheer (in-memory per serverless-instance; naast RLS en
// validatie een vangnet tegen een op hol geslagen client of misbruik van een gekaapte sessie).
const hits = new Map<string, number[]>();

export function rateLimited(key: string, max = 60, windowMs = 60_000, now = Date.now()): boolean {
  if (hits.size > 2000) hits.clear();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}
