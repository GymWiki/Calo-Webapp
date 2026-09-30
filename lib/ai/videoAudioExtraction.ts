import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Permissie-bits van een geïnstalleerd binary kunnen verloren gaan tijdens
// Vercel's deploy-packaging — zelfde klasse risico als eerder trof
// (pdf.worker.mjs, zie next.config.ts). Defensief, geen harde aanname dat
// het al uitvoerbaar is.
try {
  if (existsSync(ffmpegInstaller.path)) {
    chmodSync(ffmpegInstaller.path, 0o755);
  }
} catch {
  // Best-effort — als dit faalt, faalt de eerste echte ffmpeg-aanroep
  // vanzelf met een duidelijke fout.
}

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/**
 * Extraheert en comprimeert de audiotrack van een video naar mono ~64kbps
 * MP3 (ruim onder OpenAI's 25MB-uploadlimiet voor transcriptie, ook bij een
 * volle 10-minuten clip). ffmpeg heeft echte bestandspaden nodig (geen
 * buffers), dus dit schrijft naar Vercel's schrijfbare /tmp en ruimt beide
 * bestanden altijd op, ook bij een fout.
 *
 * Geeft `null` terug i.p.v. te gooien wanneer de video geen audiotrack
 * bevat (stille demonstratievideo) — dat is geen fout, maar een verwacht
 * scenario dat de aanroeper (videoImportProcessor.ts) afhandelt door
 * transcriptie over te slaan i.p.v. de hele job te laten falen.
 */
export async function extractCompressedAudio(
  videoBuffer: Buffer,
  originalMimeType: string,
): Promise<Buffer | null> {
  const extension = EXTENSION_BY_MIME_TYPE[originalMimeType] ?? "mp4";
  const jobTmpId = randomUUID();
  const inputPath = path.join(tmpdir(), `video-import-${jobTmpId}.${extension}`);
  const outputPath = path.join(tmpdir(), `video-import-${jobTmpId}.mp3`);

  try {
    writeFileSync(inputPath, videoBuffer);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec("libmp3lame")
        .audioChannels(1)
        .audioBitrate("64k")
        .on("error", (error: Error) => reject(error))
        .on("end", () => resolve())
        .save(outputPath);
    });

    if (!existsSync(outputPath)) {
      return null;
    }

    const audioBuffer = readFileSync(outputPath);
    // Een video zonder audiotrack levert een (bijna) leeg MP3-bestand op
    // i.p.v. dat ffmpeg faalt — een paar honderd bytes is alleen de
    // MP3-header, geen bruikbare audio.
    if (audioBuffer.length < 2048) {
      return null;
    }

    return audioBuffer;
  } catch (error) {
    // Sommige stille video's hebben helemaal geen audiostream — ffmpeg
    // gooit dan een "Output file does not contain any stream"-achtige
    // fout i.p.v. gewoon een leeg bestand te schrijven. Ook dat behandelen
    // we als "geen audio", niet als een echte verwerkingsfout.
    if (error instanceof Error && /does not contain any stream|no.*audio.*stream/i.test(error.message)) {
      return null;
    }
    throw error;
  } finally {
    for (const filePath of [inputPath, outputPath]) {
      try {
        if (existsSync(filePath)) unlinkSync(filePath);
      } catch {
        // Best-effort opruimen — een achtergebleven /tmp-bestand in een
        // wegwerp serverless-container is geen lek.
      }
    }
  }
}
