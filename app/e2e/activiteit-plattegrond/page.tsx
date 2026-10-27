import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { E2E_MODELS } from "@/components/canvas-3d/e2e-models";
import { LibraryItemCard } from "@/components/library-item-card";
import { ActivityPlattegrondBlock } from "@/components/plattegrond/ActivityPlattegrondBlock";
import { PublicActivityCard } from "@/components/public/PublicActivityCard";
import { getActivityImageUrl, getActivityVisual, withFloorplanThumbnail, type FloorplanInput } from "@/lib/activities/visual";
import type { PublicActivity } from "@/lib/services/publicActivities";
import type { Activity } from "@/types/activity";

/**
 * Testpagina voor Playwright (e2e/plattegrond-weergave.spec.ts): rendert de plattegrond-weergave van een activiteit voor elke
 * combinatie van afbeelding en 3D-plattegrond met dezelfde componenten en dezelfde regel (getActivityVisual) als de echte
 * pagina's, maar met vaste testdata (geen Supabase of login). Bestaat alleen buiten productie of met E2E_HARNESS=1.
 *
 *   ?case=afbeelding | 3d | beide | geen | ongeldig | leeg      &rol=eigenaar | bezoeker
 */
const IMAGE = "/gymwiki-logo.png";
const THUMB = "/apple-touch-icon.png";
const ACTIVITY_ID = "11111111-1111-4111-8111-111111111111";

const room = { width_m: 10, length_m: 8 };
const item = { id: "i1", slug: "testmat_groot", x: 0, y: 0, z: 0, rot_y_deg: 0 };

function floorplanFor(kind: string | undefined): FloorplanInput | null {
  const base = { id: "fp-e2e", naam: "Testplattegrond", ownerId: "u1", previewUrl: THUMB };
  if (kind === "3d" || kind === "beide") return { ...base, data: { version: 1, room, items: [item], coneFields: [] } };
  if (kind === "ongeldig") return { ...base, data: { kapot: true } };
  if (kind === "leeg") return { ...base, data: { version: 1, room, items: [], coneFields: [] } };
  return null;
}

function activityFor(kind: string | undefined) {
  const hasImage = kind === "afbeelding" || kind === "beide" || kind === "ongeldig" || kind === "leeg";
  return { afbeelding: hasImage ? IMAGE : null, diagram_image_url: null as string | null };
}

type Search = { case?: string; rol?: string };

function resolve(search: Search) {
  const activity = activityFor(search.case);
  const floorplan = floorplanFor(search.case);
  // Geen console-ruis in de test: de warning bij ongeldig/leeg hoort bij de regel zelf (unit-getest).
  const visual = getActivityVisual(activity, floorplan, () => undefined);
  const thumb = visual.type === "3d" ? visual.plattegrond.previewUrl : null;
  return { activity, visual, display: withFloorplanThumbnail(activity, thumb) };
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const { display } = resolve(await searchParams);
  const image = getActivityImageUrl(display);
  return {
    title: "Plattegrond-weergave (test)",
    openGraph: { images: image ? [{ url: image }] : undefined },
    twitter: { card: "summary_large_image", images: image ? [image] : undefined },
  };
}

export default async function PlattegrondWeergaveHarness({ searchParams }: { searchParams: Promise<Search> }) {
  if (process.env.NODE_ENV === "production" && process.env.E2E_HARNESS !== "1") notFound();

  const search = await searchParams;
  const { visual, display } = resolve(search);
  const canEdit = search.rol !== "bezoeker";

  const card = {
    id: ACTIVITY_ID,
    titel: "Testactiviteit",
    afbeelding: display.afbeelding,
    diagram_image_url: display.diagram_image_url,
    categorie: null,
    leerlijn: null,
    doelgroep: [],
    like_count: 0,
    author_id: "u1",
    visibility: "public",
    status: "approved",
  } as unknown as Activity;
  const publicCard = {
    id: ACTIVITY_ID,
    slug: "testactiviteit",
    titel: "Testactiviteit",
    seo_summary: "Samenvatting",
    afbeelding: display.afbeelding,
    doelgroep: [],
    like_count: 0,
  } as unknown as PublicActivity;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4">
      <h1 className="text-xl font-semibold">Plattegrond-weergave (test)</h1>
      <section aria-label="Detailpagina" data-testid="detail">
        <ActivityPlattegrondBlock activityId={ACTIVITY_ID} visual={visual} canEdit={canEdit} models={E2E_MODELS} />
      </section>
      <section aria-label="Bibliotheekkaart" data-testid="bibliotheekkaart" className="max-w-xs">
        <LibraryItemCard item={{ source: "public", id: ACTIVITY_ID, activity: card }} />
      </section>
      <section aria-label="Publieke kaart" data-testid="publieke-kaart" className="max-w-xs">
        <PublicActivityCard activity={publicCard} />
      </section>
    </main>
  );
}
