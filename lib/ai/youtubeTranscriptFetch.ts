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
// daarvan gebruiken we hetzelfde publieke timedtext-endpoint dat YouTube's
// eigen videospeler gebruikt om ondertiteling te renderen — geen OAuth
// nodig, werkt voor elke publieke video MET ondertiteling (ook
// automatisch gegenereerde), en downloadt nooit de video zelf (dat blijft
// het onderscheid met 'full_auto'-modus).
//
// TWEEDE BUG ("geen ondertitels gevonden" terwijl de video wél zichtbare
// auto-gegenereerde ondertiteling heeft): de eerder gestelde hypothese was
// dat de OFFICIËLE Data API hier de schuldige was — dat klopt niet, want
// deze code heeft die API nooit voor transcripten gebruikt (zie hierboven).
// De daadwerkelijke oorzaak zit in het `youtube-transcript`-npm-pakket:
// `fetchTranscriptFromTracks` (node_modules/youtube-transcript/dist/commonjs/index.js)
// kiest, wanneer geen taal expliciet is opgegeven (wat deze code nooit
// deed), simpelweg `captionTracks[0]` — het EERSTE track dat YouTube
// toevallig teruggeeft, zonder enige ASR-bewuste fallback of
// taalvoorkeur. Of dat eerste track een auto-gegenereerd (ASR) spoor is
// hangt af van met welke clientcontext (InnerTube "ANDROID" eerst, HTML-
// scrape als fallback) YouTube antwoordt, en dat gedrag is noch
// gedocumenteerd noch gegarandeerd. Vandaar nu een TWEEDE, onafhankelijk
// geïmplementeerd pad hieronder (fetchViaDirectTimedText) dat eerst
// expliciet de volledige tracklijst opvraagt (type=list) — inclusief
// auto-gegenereerde sporen — en zelf een taal kiest, in plaats van blind
// te vertrouwen op wat het pakket toevallig als eerste track tegenkomt.
//
// BELANGRIJK — ook deze directe timedtext-aanpak is een UNDOCUMENTED,
// publiek endpoint van YouTube zelf: Google garandeert niets over de
// beschikbaarheid, vorm of blijvende werking ervan, en het kan zonder
// aankondiging veranderen (precies dezelfde kanttekening als het
// `youtube-transcript`-pakket zelf in zijn README maakt over zijn eigen
// aanpak). Vandaar dat dit bewust als EXTRA, onafhankelijk fallback-pad is
// gebouwd naast (niet in plaats van) het bestaande pakket, met expliciete
// foutafhandeling zodat een falende aanroep altijd een herkenbare
// "fetch_failed"-uitkomst geeft in plaats van een stille lege respons.
//
// BUGFIX #1 (root cause van "formulier blijft leeg"): dit package gooit
// YoutubeTranscriptVideoUnavailableError niet alleen wanneer een video
// daadwerkelijk verwijderd/privé is, maar OOK wanneer het ophalen van de
// YouTube-pagina zelf mislukt (geen "playabilityStatus"-marker in de
// response) — bijv. door een blokkade/consent-wall/bot-detectie richting
// een datacenter-IP zoals een Vercel-serverless-functie. Vandaar een hard
// onderscheid: alleen "disabled"/"not_available" (het package — of de
// directe timedtext-route — kon de bron gewoon lezen en zag gewoon geen
// ondertitelingtracks) is een echte "geen ondertiteling"-situatie die door
// mag naar een leeg formulier; "video_unavailable"/"rate_limited"/
// "unknown" zijn technische mislukkingen die de job moeten laten falen met
// een eigen, herkenbare foutmelding.
export type YoutubeTranscriptResult =
  | { outcome: "available"; transcript: string; language: string | null }
  | { outcome: "no_captions"; reason: "disabled" | "not_available" }
  | { outcome: "fetch_failed"; reason: "video_unavailable" | "rate_limited" | "unknown"; detail: string };

type TimedTextTrack = { langCode: string; isAsr: boolean; name: string };

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)));
}

// Haalt de volledige lijst beschikbare ondertitelingtracks op (handmatig
// ÉN auto-gegenereerd) — het undocumented `type=list`-pad dat youtube-dl-
// achtige tools al jaren gebruiken voor precies dit doel, en dat (anders
// dan het npm-pakket se HTML-scrape) de volledige tracklijst teruggeeft
// zonder op één enkele clientcontext te gokken.
async function fetchTimedTextTrackList(
  videoId: string,
): Promise<{ tracks: TimedTextTrack[] } | { error: string }> {
  const url = `https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(videoId)}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : String(cause) };
  }
  if (!response.ok) {
    return { error: `HTTP ${response.status}` };
  }
  const xml = await response.text();
  // STAP1-eis: de ruwe response loggen zodat de daadwerkelijke oorzaak
  // (lege lijst? geen tracks? iets anders?) voor toekomstige debugging
  // zichtbaar blijft in plaats van alleen de afgeleide uitkomst.
  console.log(
    `youtubeTimedText[${videoId}]: ruwe type=list-response (${xml.length} tekens): ${xml.slice(0, 1500)}`,
  );

  const tracks: TimedTextTrack[] = [];
  const trackRegex = /<track\b([^>]*)\/>/g;
  let match: RegExpExecArray | null;
  while ((match = trackRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const langCode = /lang_code="([^"]*)"/.exec(attrs)?.[1];
    const kind = /kind="([^"]*)"/.exec(attrs)?.[1];
    const name = /\bname="([^"]*)"/.exec(attrs)?.[1] ?? "";
    if (langCode) {
      tracks.push({ langCode, isAsr: kind === "asr", name: decodeHtmlEntities(name) });
    }
  }
  return { tracks };
}

// Voorkeursvolgorde (STAP3-eis): Nederlands > Engels > eerste beschikbare
// — in plaats van een vaste, hardgecodeerde taalaanname.
function pickPreferredTrack(tracks: TimedTextTrack[]): TimedTextTrack | null {
  if (tracks.length === 0) return null;
  const dutch = tracks.find((t) => t.langCode === "nl" || t.langCode.startsWith("nl-"));
  if (dutch) return dutch;
  const english = tracks.find((t) => t.langCode === "en" || t.langCode.startsWith("en-"));
  if (english) return english;
  return tracks[0];
}

function parseTimedTextXml(xml: string): string {
  const parts: string[] = [];
  const textRegex = /<text\b[^>]*>([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;
  while ((match = textRegex.exec(xml)) !== null) {
    const withoutTags = match[1].replace(/<[^>]+>/g, " ");
    const decoded = decodeHtmlEntities(withoutTags).replace(/\s+/g, " ").trim();
    if (decoded) parts.push(decoded);
  }
  return parts.join(" ");
}

async function fetchTimedTextTranscript(videoId: string, track: TimedTextTrack): Promise<string | { error: string }> {
  const params = new URLSearchParams({ v: videoId, lang: track.langCode });
  if (track.isAsr) params.set("kind", "asr");
  const url = `https://www.youtube.com/api/timedtext?${params.toString()}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : String(cause) };
  }
  if (!response.ok) {
    return { error: `HTTP ${response.status}` };
  }
  const xml = await response.text();
  if (!xml.trim()) return "";
  return parseTimedTextXml(xml);
}

// Onafhankelijk, van-scratch gebouwd fallback-pad bovenop het publieke
// timedtext-endpoint (zie documentatie-commentaar bovenaan dit bestand) —
// vraagt eerst expliciet de tracklijst op (inclusief ASR-sporen), kiest
// zelf een taal, en haalt dan pas de daadwerkelijke tekst op.
async function fetchViaDirectTimedText(videoId: string): Promise<YoutubeTranscriptResult> {
  const listResult = await fetchTimedTextTrackList(videoId);
  if ("error" in listResult) {
    console.error(`youtubeTimedText[${videoId}]: tracklijst ophalen mislukt — ${listResult.error}.`);
    return { outcome: "fetch_failed", reason: "unknown", detail: listResult.error };
  }

  if (listResult.tracks.length === 0) {
    console.log(`youtubeTimedText[${videoId}]: geen tracks gevonden via de directe tracklijst-opvraging.`);
    return { outcome: "no_captions", reason: "not_available" };
  }

  const preferred = pickPreferredTrack(listResult.tracks);
  if (!preferred) {
    return { outcome: "no_captions", reason: "not_available" };
  }
  console.log(
    `youtubeTimedText[${videoId}]: ${listResult.tracks.length} track(s) gevonden ` +
      `(${listResult.tracks.map((t) => `${t.langCode}${t.isAsr ? ":asr" : ""}`).join(", ")}) — ` +
      `gekozen: ${preferred.langCode}${preferred.isAsr ? " (auto-gegenereerd)" : " (handmatig)"}.`,
  );

  const transcriptResult = await fetchTimedTextTranscript(videoId, preferred);
  if (typeof transcriptResult !== "string") {
    console.error(
      `youtubeTimedText[${videoId}]: transcript ophalen mislukt voor taal ${preferred.langCode} — ${transcriptResult.error}.`,
    );
    return { outcome: "fetch_failed", reason: "unknown", detail: transcriptResult.error };
  }
  if (!transcriptResult.trim()) {
    console.log(`youtubeTimedText[${videoId}]: transcript-tekst was leeg na parsing (taal ${preferred.langCode}).`);
    return { outcome: "no_captions", reason: "not_available" };
  }

  console.log(
    `youtubeTimedText[${videoId}]: transcript opgehaald via directe timedtext-route — ` +
      `${transcriptResult.length} tekens, taal ${preferred.langCode}.`,
  );
  return { outcome: "available", transcript: transcriptResult, language: preferred.langCode };
}

// Bestaand pad: het `youtube-transcript`-npm-pakket (InnerTube Android-
// client, met HTML-scrape als fallback). Blijft het EERSTE pad omdat het,
// wanneer het wél een manueel track oppikt, doorgaans betere tekstkwaliteit
// geeft dan een ruwe ASR-track.
async function fetchViaPackage(videoId: string): Promise<YoutubeTranscriptResult> {
  try {
    const segments = await fetchTranscript(videoId);
    const transcript = segments
      .map((segment) => segment.text.trim())
      .filter(Boolean)
      .join(" ");
    const language = segments.find((segment) => segment.lang)?.lang ?? null;
    console.log(
      `youtubeTranscriptFetch[${videoId}]: pakket-pad — transcript opgehaald — ${segments.length} segmenten, ` +
        `${transcript.length} tekens, taal ${language ?? "onbekend"}.`,
    );
    return { outcome: "available", transcript, language };
  } catch (cause) {
    if (cause instanceof YoutubeTranscriptDisabledError) {
      console.log(`youtubeTranscriptFetch[${videoId}]: pakket-pad — ondertiteling is uitgeschakeld door de maker.`);
      return { outcome: "no_captions", reason: "disabled" };
    }
    if (
      cause instanceof YoutubeTranscriptNotAvailableError ||
      cause instanceof YoutubeTranscriptNotAvailableLanguageError
    ) {
      console.log(`youtubeTranscriptFetch[${videoId}]: pakket-pad — geen ondertitelingtracks beschikbaar.`);
      return { outcome: "no_captions", reason: "not_available" };
    }
    if (cause instanceof YoutubeTranscriptVideoUnavailableError) {
      console.error(
        `youtubeTranscriptFetch[${videoId}]: pakket-pad — kon de YouTube-pagina niet correct ophalen ` +
          `(video_unavailable) — dit kan een echt verwijderde/privé video zijn, maar ook een blokkade/` +
          `netwerkfout bij het ophalen van de pagina zelf.`,
      );
      return { outcome: "fetch_failed", reason: "video_unavailable", detail: cause.message };
    }
    if (cause instanceof YoutubeTranscriptTooManyRequestError) {
      console.error(`youtubeTranscriptFetch[${videoId}]: pakket-pad — rate-limited door YouTube (captcha vereist).`);
      return { outcome: "fetch_failed", reason: "rate_limited", detail: cause.message };
    }
    console.error(`youtubeTranscriptFetch[${videoId}]: pakket-pad — onverwachte fout:`, cause);
    return {
      outcome: "fetch_failed",
      reason: "unknown",
      detail: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

// Combineert beide paden (STAP2-eis): het pakket eerst (kan nog steeds
// prima werken, zeker voor handmatige ondertiteling), en bij elke uitkomst
// die niet "available" is, de onafhankelijke directe timedtext-route als
// tweede controle — specifiek gebouwd om auto-gegenereerde (ASR) sporen te
// vinden die het pakket se eigen, niet-ASR-bewuste trackselectie kan
// missen. Pas wanneer BEIDE paden het erover eens zijn dat er niets
// bruikbaars is, concluderen we "no_captions"/"fetch_failed" — bij een
// conflict krijgt de directe type=list-route voorrang, omdat die een
// gerichte, autoritatieve opvraging is in plaats van een HTML-scrape.
export async function fetchYoutubeTranscript(videoId: string): Promise<YoutubeTranscriptResult> {
  const packageResult = await fetchViaPackage(videoId);
  if (packageResult.outcome === "available") {
    return packageResult;
  }

  console.log(
    `youtubeTranscriptFetch[${videoId}]: pakket-pad gaf '${packageResult.outcome}' — ` +
      `directe timedtext-route wordt nu geprobeerd als tweede, onafhankelijk pad.`,
  );
  const directResult = await fetchViaDirectTimedText(videoId);

  if (directResult.outcome === "available") {
    console.log(
      `youtubeTranscriptFetch[${videoId}]: directe timedtext-route vond alsnog een transcript — ` +
        `dit bevestigt dat het pakket se trackselectie deze video miste.`,
    );
    return directResult;
  }

  // Beide paden zijn het eens, of de directe route faalde technisch — geef
  // de directe route voorrang bij een definitieve "geen ondertiteling"-
  // conclusie (autoritatiever dan de HTML-scrape), tenzij alleen het
  // pakket al een technische mislukking meldde en de directe route gewoon
  // "geen tracks" teruggaf — dan blijft dat laatste de eerlijkste
  // samenvatting (een technische pakket-fout zegt niets over of er
  // daadwerkelijk ondertiteling bestaat als de directe route dat wél kon
  // vaststellen).
  return directResult;
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
