import { notFound } from "next/navigation";

import { AnchorsHarness } from "./AnchorsHarness";

/**
 * Testpagina voor de voor/na-screenshots van de anchors (docs/anchor-audit.md, scripts/anchor-screenshots.mjs): twee echte korfbalpalen
 * (GLB uit de publieke Supabase-bucket) met een touw ertussen.
 *   ?stand=voor   het touw zoals voor de anchors: uiteinden aan de rand van de gele korf (opgeslagen punt, zonder anchor)
 *   ?stand=na     hetzelfde opgeslagen touw, nu aan het bevestigingspunt op de paal (automatisch gemigreerd)
 *   &anchors=1    toon alle bevestigingspunten met label (debug "Toon anchors")
 * Bestaat alleen buiten productie of met E2E_HARNESS=1.
 */
export default async function AnchorsPage({ searchParams }: { searchParams: Promise<{ stand?: string; anchors?: string; slug?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.E2E_HARNESS !== "1") notFound();
  const { stand = "na", anchors, slug = "korfbalpaal_compleet_250" } = await searchParams;
  return <AnchorsHarness stand={stand === "voor" ? "voor" : "na"} showAnchors={anchors === "1"} slug={slug} supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""} />;
}
