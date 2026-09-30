import { randomUUID } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import { open as openFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Innertube } from "youtubei.js";
import { VIDEO_MAX_FILE_SIZE_BYTES } from "@/lib/ai/videoTypes";

// Alleen gebruikt in 'full_auto'-modus (zie lib/ai/youtubeImportMode.ts) —
// downloadt de video server-side, exact zoals de bestandsupload-route
// daarna verder verwerkt (audio-extractie, frame-extractie). youtubei.js
// i.p.v. ytdl-core/@distube/ytdl-core: die laatste raadt in zijn eigen
// README inmiddels af ("no longer maintained, please use youtubei.js
// instead") — voor een NIEUWE integratie is het actief onderhouden
// alternatief de betere keuze, ook al is de API iets zwaarder (simuleert
// een echte YouTube-client i.p.v. een kale HTTP-aanroep).
let innertubeClient: Promise<Innertube> | null = null;
function getInnertube(): Promise<Innertube> {
  if (!innertubeClient) {
    innertubeClient = Innertube.create();
  }
  return innertubeClient;
}

export type DownloadedYoutubeVideo = { filePath: string };

/**
 * Downloadt de video naar Vercel's schrijfbare /tmp, met een harde
 * bytelimiet TIJDENS het downloaden (niet pas achteraf controleren) —
 * `quality: "360p"` houdt bestanden klein voor de gebruikelijke duur-
 * limiet (10 min), maar een defensieve cap voorkomt dat een onverwacht
 * hoge bitrate alsnog een te grote download veroorzaakt. Bij overschrijding
 * wordt het partiële bestand direct opgeruimd.
 */
export async function downloadYoutubeVideoToTemp(videoId: string): Promise<DownloadedYoutubeVideo> {
  const innertube = await getInnertube();

  let webStream: ReadableStream<Uint8Array>;
  try {
    webStream = await innertube.download(videoId, { type: "video+audio", quality: "360p" });
  } catch {
    // Niet elke video heeft een progressive 360p-stream (bijv. alleen hoge
    // resoluties beschikbaar) — val terug op "beste beschikbare
    // video+audio-combinatie" i.p.v. hard te falen op een te specifieke
    // kwaliteitseis.
    webStream = await innertube.download(videoId, { type: "video+audio" });
  }

  const filePath = path.join(tmpdir(), `youtube-import-${randomUUID()}.mp4`);
  const fileHandle = await openFile(filePath, "w");
  let totalBytes = 0;

  try {
    const reader = webStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > VIDEO_MAX_FILE_SIZE_BYTES) {
        throw new Error("Video overschrijdt de toegestane bestandsgrootte tijdens downloaden.");
      }
      await fileHandle.write(value);
    }
  } catch (cause) {
    await fileHandle.close().catch(() => {});
    cleanupYoutubeDownload(filePath);
    throw cause;
  }

  await fileHandle.close();
  return { filePath };
}

/**
 * Ruimt het tijdelijk gedownloade videobestand op — STAP-eis (DEEL4):
 * "verwijder het tijdelijk gedownloade videobestand direct na verwerking".
 * Wordt door de aanroeper in een `finally` aangeroepen zodat dit ook bij
 * een mislukte verwerking gebeurt.
 */
export function cleanupYoutubeDownload(filePath: string): void {
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {
    // Best-effort — een achtergebleven /tmp-bestand in een wegwerp
    // serverless-container is geen lek.
  }
}
