import type { Activity } from "@/types/activity";

/**
 * De afbeelding die de PDF-export als "plattegrond/veldopstelling" moet
 * tonen — diagram_image_url (canvas-editor-export) heeft voorrang op het
 * oudere, losse afbeelding-veld. GEEN aanname dat diagram_data ooit gevuld
 * is zodra diagram_image_url dat is: voor GymWiki-basisbibliotheek-content
 * (geïmporteerd vóór de canvas-editor bestond) is diagram_data altijd null,
 * ook als er wél een afbeelding staat.
 */
export function getArrangementImage(
  activity: Pick<Activity, "diagram_image_url" | "afbeelding">,
): string | null {
  return activity.diagram_image_url ?? activity.afbeelding ?? null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("FileReader mislukt."));
    reader.readAsDataURL(blob);
  });
}

async function fetchAsDataUrl(url: string, init?: RequestInit): Promise<string | null> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

/**
 * Haalt de plattegrond-afbeelding op als data-URL, zodat @react-pdf/renderer
 * 'm synchroon kan embedden i.p.v. zelf een fetch te doen. Die eigen fetch
 * (binnen react-pdf's <Image>) faalt hard — en laat de HELE PDF-export
 * mislukken, niet alleen de afbeelding — zodra de response geen geldige
 * afbeelding-bytes bevat: bijv. een JSON-foutpagina bij een CORS-block, een
 * verlopen/ontoegankelijke URL, of (zie hieronder) een niet-toegestane host.
 *
 * Probeert eerst rechtstreeks (`fetch(url, { mode: "cors" })`, werkt voor
 * afbeeldingen met CORS-headers — o.a. de oudere Firebase Storage-URL's van
 * de GymWiki-basisbibliotheek, van vóór Supabase Storage). Valt daarna terug
 * op de same-origin proxy (server-naar-server, dus geen CORS-afhankelijkheid
 * — zie app/api/activity-image-proxy/route.ts), die alleen URL's van dít
 * Supabase-project z'n Storage accepteert. Geeft null terug als beide
 * pogingen mislukken; de aanroeper laat de afbeelding dan gewoon weg i.p.v.
 * de hele export te laten mislukken.
 */
export async function loadArrangementImageDataUrl(url: string): Promise<string | null> {
  const direct = await fetchAsDataUrl(url, { mode: "cors" });
  if (direct) return direct;

  return fetchAsDataUrl(`/api/activity-image-proxy?url=${encodeURIComponent(url)}`);
}
