import {
  fetchTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from "youtube-transcript";

// LET OP — dit gebruikt BEWUST niet de officiële YouTube Data API v3
// captions.download-endpoint. Die is een OAuth 2.0-geautoriseerde aanroep
// die alleen werkt voor video's van het EIGEN, ingelogde kanaal van de
// aanroeper (zie https://developers.google.com/youtube/v3/docs/captions/download)
// — onbruikbaar voor "een gebruiker plakt een willekeurige YouTube-link",
// want dat zou elke lesgever verplichten hun YouTube-account aan GymWiki te
// koppelen, voor video's die ze meestal niet eens zelf beheren. In plaats
// daarvan gebruikt dit package (youtube-transcript) hetzelfde publieke
// timedtext-endpoint dat YouTube's eigen videospeler gebruikt om
// ondertiteling te renderen — geen OAuth nodig, werkt voor elke publieke
// video MET ondertiteling, en downloadt nooit de video zelf (dat blijft het
// onderscheid met 'full_auto'-modus). Dit is de gangbare, breed gebruikte
// aanpak voor "transcript van een willekeurige YouTube-video ophalen" —
// geen document-API, dus kan in theorie breken bij een YouTube-wijziging
// (vandaar de package se eigen "unofficial API" waarschuwing in de README).
export type YoutubeTranscriptResult =
  | { available: true; transcript: string }
  | { available: false; reason: "disabled" | "not_available" | "video_unavailable" | "rate_limited" | "unknown" };

export async function fetchYoutubeTranscript(videoId: string): Promise<YoutubeTranscriptResult> {
  try {
    const segments = await fetchTranscript(videoId);
    const transcript = segments
      .map((segment) => segment.text.trim())
      .filter(Boolean)
      .join(" ");
    return { available: true, transcript };
  } catch (cause) {
    if (cause instanceof YoutubeTranscriptDisabledError) {
      return { available: false, reason: "disabled" };
    }
    if (
      cause instanceof YoutubeTranscriptNotAvailableError ||
      cause instanceof YoutubeTranscriptNotAvailableLanguageError
    ) {
      return { available: false, reason: "not_available" };
    }
    if (cause instanceof YoutubeTranscriptVideoUnavailableError) {
      return { available: false, reason: "video_unavailable" };
    }
    if (cause instanceof YoutubeTranscriptTooManyRequestError) {
      return { available: false, reason: "rate_limited" };
    }
    console.error("youtubeTranscriptFetch: onverwachte fout:", cause);
    return { available: false, reason: "unknown" };
  }
}

// Nederlandse, vriendelijke meldingen per reden — gebruikt door de
// mapping-fase (videoImportProcessor.ts) om error_message te vullen, en
// rechtstreeks bruikbaar in de UI.
export const TRANSCRIPT_UNAVAILABLE_MESSAGES: Record<
  Exclude<YoutubeTranscriptResult, { available: true }>["reason"],
  string
> = {
  disabled:
    "Deze video heeft geen ondertiteling (uitgeschakeld door de maker). Vul de activiteit handmatig in, of upload een schermafbeelding voor de plattegrond.",
  not_available:
    "Er is geen ondertiteling beschikbaar voor deze video. Vul de activiteit handmatig in, of upload een schermafbeelding voor de plattegrond.",
  video_unavailable:
    "Deze video is niet (meer) beschikbaar op YouTube. Controleer de link.",
  rate_limited:
    "YouTube limiteert momenteel het ophalen van ondertiteling. Probeer het over een paar minuten opnieuw.",
  unknown:
    "Kon de ondertiteling van deze video niet ophalen. Vul de activiteit handmatig in, of upload een schermafbeelding voor de plattegrond.",
};
