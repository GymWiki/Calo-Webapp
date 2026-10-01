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
//
// BUGFIX (root cause van "formulier blijft leeg"): dit package gooit
// YoutubeTranscriptVideoUnavailableError niet alleen wanneer een video
// daadwerkelijk verwijderd/privé is, maar OOK wanneer het ophalen van de
// YouTube-pagina zelf mislukt (geen "playabilityStatus"-marker in de
// response) — bijv. door een blokkade/consent-wall/bot-detectie richting
// een datacenter-IP zoals een Vercel-serverless-functie. Rechtstreeks
// getest tegen een gegarandeerd bestaande, publieke video: dezelfde fout
// trad op zodra de paginarequest zelf niet goed binnenkwam. De vorige
// versie van dit bestand behandelde die fout (en rate_limited/unknown)
// stilzwijgend hetzelfde als "video heeft écht geen ondertiteling" —
// waardoor een TECHNISCHE mislukking altijd eindigde in een leeg, "geslaagd"
// formulier zonder enige foutmelding. Vandaar nu een hard onderscheid: alleen
// "disabled"/"not_available" (het package kon de pagina gewoon lezen en zag
// gewoon geen ondertitelingtracks) is een echte "geen ondertiteling"-situatie
// die door mag naar een leeg formulier; "video_unavailable"/"rate_limited"/
// "unknown" zijn technische mislukkingen die de job moeten laten falen met
// een eigen, herkenbare foutmelding.
export type YoutubeTranscriptResult =
  | { outcome: "available"; transcript: string }
  | { outcome: "no_captions"; reason: "disabled" | "not_available" }
  | { outcome: "fetch_failed"; reason: "video_unavailable" | "rate_limited" | "unknown"; detail: string };

export async function fetchYoutubeTranscript(videoId: string): Promise<YoutubeTranscriptResult> {
  try {
    const segments = await fetchTranscript(videoId);
    const transcript = segments
      .map((segment) => segment.text.trim())
      .filter(Boolean)
      .join(" ");
    console.log(
      `youtubeTranscriptFetch[${videoId}]: transcript opgehaald — ${segments.length} segmenten, ${transcript.length} tekens.`,
    );
    return { outcome: "available", transcript };
  } catch (cause) {
    if (cause instanceof YoutubeTranscriptDisabledError) {
      console.log(`youtubeTranscriptFetch[${videoId}]: ondertiteling is uitgeschakeld door de maker.`);
      return { outcome: "no_captions", reason: "disabled" };
    }
    if (
      cause instanceof YoutubeTranscriptNotAvailableError ||
      cause instanceof YoutubeTranscriptNotAvailableLanguageError
    ) {
      console.log(`youtubeTranscriptFetch[${videoId}]: geen ondertitelingtracks beschikbaar voor deze video.`);
      return { outcome: "no_captions", reason: "not_available" };
    }
    if (cause instanceof YoutubeTranscriptVideoUnavailableError) {
      console.error(
        `youtubeTranscriptFetch[${videoId}]: kon de YouTube-pagina niet correct ophalen (video_unavailable) — ` +
          `dit kan een echt verwijderde/privé video zijn, maar ook een blokkade/netwerkfout bij het ophalen ` +
          `van de pagina zelf. Behandeld als technische mislukking, niet als "geen ondertiteling".`,
      );
      return { outcome: "fetch_failed", reason: "video_unavailable", detail: cause.message };
    }
    if (cause instanceof YoutubeTranscriptTooManyRequestError) {
      console.error(`youtubeTranscriptFetch[${videoId}]: rate-limited door YouTube (captcha vereist).`);
      return { outcome: "fetch_failed", reason: "rate_limited", detail: cause.message };
    }
    console.error(`youtubeTranscriptFetch[${videoId}]: onverwachte fout:`, cause);
    return {
      outcome: "fetch_failed",
      reason: "unknown",
      detail: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

// Nederlandse, vriendelijke meldingen voor een ECHTE "geen ondertiteling"-
// situatie (STAP3/DEEL3-gedrag: job gaat gewoon door, gebruiker kan
// handmatig invullen).
export const NO_CAPTIONS_MESSAGES: Record<"disabled" | "not_available", string> = {
  disabled:
    "Deze video heeft geen ondertiteling (uitgeschakeld door de maker). Vul de activiteit handmatig in, of upload een schermafbeelding voor de plattegrond.",
  not_available:
    "Er is geen ondertiteling beschikbaar voor deze video. Vul de activiteit handmatig in, of upload een schermafbeelding voor de plattegrond.",
};

// Meldingen voor een TECHNISCHE mislukking — de job faalt (status 'failed'),
// zodat de gebruiker een eerlijke, specifieke melding krijgt i.p.v. een
// stilzwijgend leeg formulier.
export const FETCH_FAILED_MESSAGES: Record<"video_unavailable" | "rate_limited" | "unknown", string> = {
  video_unavailable:
    "Kon de ondertiteling van deze video niet ophalen door een technisch probleem (YouTube-pagina kon niet worden gelezen). Probeer het later opnieuw, of vul de activiteit handmatig in.",
  rate_limited:
    "YouTube limiteert momenteel het ophalen van ondertiteling. Probeer het over een paar minuten opnieuw.",
  unknown:
    "Kon de ondertiteling van deze video niet ophalen door een onverwachte fout. Probeer het opnieuw of vul de activiteit handmatig in.",
};
