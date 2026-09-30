// YouTube-video-ID's zijn altijd exact 11 tekens uit dit alfabet.
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Herkent youtube.com/watch?v=, youtu.be/, youtube.com/shorts/ (en de
 * m.youtube.com-varianten daarvan) en geeft het video-ID terug, of `null`
 * bij een niet-herkend formaat. Puur string-parsing, geen netwerkaanroep —
 * veilig om client-side te gebruiken voor directe feedback vóórdat de
 * server-actie (die wél een netwerkaanroep doet, zie
 * fetchYoutubeVideoMetadata) iets aanroept.
 */
export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    // Toestaan dat iemand alleen "youtube.com/watch?v=..." plakt, zonder
    // schema.
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^m\./, "").replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id && VIDEO_ID_PATTERN.test(id) ? id : null;
    }
    const shortsMatch = url.pathname.match(/^\/shorts\/([^/]+)/);
    if (shortsMatch && VIDEO_ID_PATTERN.test(shortsMatch[1])) {
      return shortsMatch[1];
    }
    const embedMatch = url.pathname.match(/^\/embed\/([^/]+)/);
    if (embedMatch && VIDEO_ID_PATTERN.test(embedMatch[1])) {
      return embedMatch[1];
    }
  }

  return null;
}

export type YoutubeVideoMetadata = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  durationSeconds: number;
};

// ISO 8601-duur zoals de YouTube Data API die teruggeeft ("PT1H2M3S",
// "PT45S", ...) — Date-parsing kan dit formaat niet aan, vandaar een eigen
// kleine parser i.p.v. een dependency voor 15 regels werk.
function parseIso8601Duration(iso: string): number {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const [, hours, minutes, seconds] = match;
  return (Number(hours ?? 0) * 3600) + (Number(minutes ?? 0) * 60) + Number(seconds ?? 0);
}

/**
 * Haalt titel, thumbnail en duur op via de officiële YouTube Data API v3
 * (`videos.list`, part=snippet,contentDetails) — publieke metadata, werkt
 * met alleen een API-key (YOUTUBE_API_KEY), geen OAuth nodig. Gebruikt voor
 * zowel de bevestigingskaart ("is dit de juiste video?") als de vooraf-
 * duurvalidatie, in ÉÉN aanroep, zodat beide altijd dezelfde bron gebruiken
 * (i.p.v. bijv. oEmbed voor titel/thumbnail en de Data API los voor duur —
 * die zouden in theorie kunnen verschillen, en oEmbed geeft sowieso geen
 * duur terug).
 *
 * Geeft `null` terug bij een niet-bestaande/privé/verwijderde video (de API
 * geeft dan gewoon een lege `items`-array terug, geen foutcode) — de
 * aanroeper toont in dat geval een "video niet gevonden"-melding.
 */
export async function fetchYoutubeVideoMetadata(videoId: string): Promise<YoutubeVideoMetadata | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY ontbreekt. Zet deze omgevingsvariabele om YouTube-links te kunnen verwerken.");
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`YouTube Data API-aanroep mislukt (status ${response.status}).`);
  }

  const data = await response.json();
  const item = data.items?.[0];
  if (!item) return null;

  const thumbnails = item.snippet?.thumbnails ?? {};
  const thumbnailUrl =
    thumbnails.medium?.url ?? thumbnails.default?.url ?? thumbnails.high?.url ?? "";

  return {
    videoId,
    title: item.snippet?.title ?? "Onbekende titel",
    thumbnailUrl,
    durationSeconds: parseIso8601Duration(item.contentDetails?.duration ?? "PT0S"),
  };
}
