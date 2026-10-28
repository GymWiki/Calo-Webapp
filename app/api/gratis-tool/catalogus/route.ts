import { NextResponse, type NextRequest } from "next/server";

import { getActiveMaterialModels } from "@/lib/services/materialModels";
import { createServiceClient } from "@/utils/supabase/service";
import type { MaterialModel } from "@/types/materialModel";

/**
 * Publieke, alleen-lezen catalogus voor de gratis 3D-tool (itemdefinities + thumbnail-/GLB-URL's uit de publieke bucket).
 * `material_models` heeft RLS "alleen ingelogd", daarom leest deze route met de service-client op de SERVER — de sleutel verlaat
 * de server nooit en er is geen RLS-wijziging (dus geen productiemigratie) nodig. Alleen deze ene, vaste query wordt uitgevoerd.
 *
 * Bescherming: CDN-cache (s-maxage) zodat de database nauwelijks geraakt wordt, een module-cache per instance en een
 * eenvoudige limiet per IP voor cache-missers.
 */
const CACHE_TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 30;

let cache: { at: number; models: MaterialModel[] } | null = null;
const hits = new Map<string, { windowStart: number; count: number }>();

function rateLimited(ip: string, now: number): boolean {
  if (hits.size > 5000) hits.clear();
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    hits.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX;
}

export async function GET(request: NextRequest) {
  const now = Date.now();
  if (!cache || now - cache.at > CACHE_TTL_MS) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "onbekend";
    if (rateLimited(ip, now)) {
      return NextResponse.json({ error: "Te veel verzoeken. Probeer het zo opnieuw." }, { status: 429, headers: { "Retry-After": "60" } });
    }
    try {
      cache = { at: now, models: await getActiveMaterialModels(createServiceClient()) };
    } catch {
      if (!cache) return NextResponse.json({ error: "Catalogus tijdelijk niet beschikbaar." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  return NextResponse.json(
    { models: cache!.models },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400, max-age=300" } },
  );
}
