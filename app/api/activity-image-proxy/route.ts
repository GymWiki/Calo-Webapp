import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

// Root cause van de ontbrekende plattegrond-afbeelding in de PDF-export
// (ActivityPdfDocument, voor "eenvoudige activiteiten"): @react-pdf/renderer
// draait volledig in de browser en haalt een externe `src`-URL zelf op via
// `fetch()` — in tegenstelling tot een gewone <img>-tag vereist dat wél
// CORS-headers op de Supabase Storage-response. Als die ontbreken (bijv. op
// oudere, via het migratiescript geïmporteerde afbeeldingen) faalt die fetch
// stil: @react-pdf logt alleen een console.warn en laat de afbeelding
// gewoon weg, dus de PDF wordt zonder foutmelding gegenereerd maar mist de
// plattegrond. Deze route haalt de afbeelding in plaats daarvan hier
// SERVER-SIDE op (server-naar-server kent geen CORS) en serveert 'm same-
// origin terug, zodat @react-pdf/renderer's eigen fetch nooit meer een
// cross-origin verzoek hoeft te doen — ongeacht de CORS-configuratie van de
// onderliggende Storage-bucket.
//
// Alleen ingelogde gebruikers (net als de rest van de app) en alleen URL's
// die daadwerkelijk naar dit Supabase-project z'n Storage wijzen — dit is
// geen open image-proxy.
const SUPABASE_STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/`;

export async function GET(request: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url || !SUPABASE_STORAGE_PREFIX || !url.startsWith(SUPABASE_STORAGE_PREFIX)) {
    return NextResponse.json({ error: "Ongeldige afbeeldings-URL." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, { cache: "no-store" });
  } catch (error) {
    console.error("activity-image-proxy: ophalen mislukt —", error);
    return NextResponse.json({ error: "Afbeelding ophalen is mislukt." }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "Afbeelding niet gevonden." },
      { status: upstream.status === 404 ? 404 : 502 },
    );
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      // Elke activiteit-afbeelding staat op een stabiel pad met een
      // cache-buster-querystring bij een nieuwe versie (zie
      // uploadDiagramImage in lesson-form.tsx) — veilig lang te cachen.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
