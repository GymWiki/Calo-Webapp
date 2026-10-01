// Gedeelde OpenAI-foutafhandeling, geëxtraheerd uit activityImportProcessor.ts
// — geen gedragswijziging t.o.v. de oorspronkelijke, niet-geëxporteerde versie.
export type OpenAiLikeError = { status?: number; type?: string; code?: string; message: string };

export function isOpenAiApiError(cause: unknown): cause is OpenAiLikeError {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "message" in cause &&
    ("status" in cause || "type" in cause || "code" in cause)
  );
}

export function logAiFailure(logPrefix: string, stage: string, cause: unknown) {
  if (isOpenAiApiError(cause)) {
    console.error(
      `${logPrefix} (${stage}): OpenAI API-fout (status ${cause.status ?? "onbekend"}, ` +
        `type ${cause.type ?? "onbekend"}, code ${cause.code ?? "onbekend"}): ${cause.message}`,
    );
    return;
  }
  console.error(`${logPrefix} (${stage}): onverwachte fout:`, cause);
}

export function aiMappingUserMessage(cause: unknown, fallbackMessage: string): string {
  if (isOpenAiApiError(cause)) {
    if (cause.status === 429) {
      return "De AI-service zit tijdelijk aan de limiet. Probeer het over een paar minuten opnieuw.";
    }
    if (cause.status && cause.status >= 500) {
      return "De AI-service is momenteel niet bereikbaar. Probeer het opnieuw.";
    }
  }
  return fallbackMessage;
}
