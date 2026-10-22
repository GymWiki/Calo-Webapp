// Zie app/api/pdf-export-error/route.ts: dit relayt de client-side PDF-
// exportfout naar Vercel's server-logs (die wél doorzoekbaar/bewaard zijn),
// in plaats van 'm alleen in de browser-console te laten verdwijnen. Fire-
// and-forget — als loggen zelf faalt (bijv. offline) mag dat de al lopende
// foutafhandeling van de export niet nog een keer laten crashen.
export function reportPdfExportError(details: {
  component: "ActivityPdfButton" | "LessonPdfButton";
  activityId: string;
  error: unknown;
  arrangementImageAttempted: boolean;
  arrangementImageLoaded: boolean;
}) {
  const { component, activityId, error, arrangementImageAttempted, arrangementImageLoaded } = details;

  fetch("/api/pdf-export-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      component,
      activityId,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      arrangementImageAttempted,
      arrangementImageLoaded,
    }),
  }).catch(() => {
    // Best effort — een falende log-POST mag de gebruiker geen tweede fout tonen.
  });
}

// Onderscheidt een mislukte dynamic import (bijv. na een nieuwe deploy: de
// oude JS-chunk-hash bestaat niet meer op de server, of een netwerkstoring
// tijdens het laden van de ~2,8MB @react-pdf/renderer-chunk) van een echte
// render-fout — de eerste categorie los je op met "ververs de pagina", de
// tweede niet.
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "ChunkLoadError") return true;
  return /loading chunk|dynamically imported module|failed to fetch/i.test(error.message);
}

export function describePdfExportFailure(details: {
  error: unknown;
  arrangementImageAttempted: boolean;
  arrangementImageLoaded: boolean;
}): string {
  const { error, arrangementImageAttempted, arrangementImageLoaded } = details;

  if (isChunkLoadError(error)) {
    return "Kon de PDF-module niet laden. Ververs de pagina en probeer het opnieuw.";
  }

  if (arrangementImageAttempted && !arrangementImageLoaded) {
    return "PDF genereren is mislukt — mogelijk kon de plattegrond-afbeelding niet geladen worden. Probeer het opnieuw.";
  }

  return "PDF genereren is mislukt door een onverwachte fout. Probeer het opnieuw.";
}
