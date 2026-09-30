import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ffmpeg } from "@/lib/ai/ffmpegSetup";
import { VIDEO_FRAME_MAX_COUNT, computeFrameIntervalSeconds } from "@/lib/ai/videoTypes";

/**
 * Server-side tegenhanger van de client-side canvas/<video>-frame-vastlegging
 * (zie VideoImportUploadCard.tsx's captureCandidateFrames) — nodig voor het
 * YouTube full_auto-pad, waar de video alleen server-side bestaat (net
 * gedownload, geen browser-<video>-element beschikbaar). Gebruikt fluent-
 * ffmpeg's .screenshots() met EXPLICIETE tijdmarkeringen in seconden i.p.v.
 * percentages: percentage-timemarks laten fluent-ffmpeg intern `ffprobe`
 * aanroepen om de duur op te zoeken, en dit project heeft geen ffprobe-
 * binary geïnstalleerd (alleen @ffmpeg-installer/ffmpeg) — de duur is hier
 * toch al bekend (uit de YouTube-metadata, vóór download opgehaald), dus
 * expliciete timemarks omzeilen die afhankelijkheid volledig.
 */
export async function extractFramesFromVideoFile(
  videoFilePath: string,
  durationSeconds: number,
): Promise<Buffer[]> {
  const interval = computeFrameIntervalSeconds(durationSeconds);
  const timemarks: number[] = [];
  for (let t = interval; t < durationSeconds && timemarks.length < VIDEO_FRAME_MAX_COUNT; t += interval) {
    timemarks.push(t);
  }
  if (timemarks.length === 0) {
    // Zeer korte video — neem in elk geval het midden.
    timemarks.push(durationSeconds / 2);
  }

  const outDir = path.join(tmpdir(), `youtube-frames-${randomUUID()}`);
  await mkdir(outDir, { recursive: true });

  try {
    const filenames = await new Promise<string[]>((resolve, reject) => {
      let generatedFilenames: string[] = [];
      ffmpeg(videoFilePath)
        .on("filenames", (names: string[]) => {
          generatedFilenames = names;
        })
        .on("error", (error: Error) => reject(error))
        .on("end", () => resolve(generatedFilenames))
        .screenshots({
          timemarks,
          folder: outDir,
          filename: "frame-%i.jpg",
          size: "640x?",
        });
    });

    return filenames
      .map((name) => path.join(outDir, name))
      .filter((filePath) => existsSync(filePath))
      .map((filePath) => readFileSync(filePath));
  } finally {
    try {
      if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
    } catch {
      // Best-effort opruimen — een achtergebleven /tmp-map in een wegwerp
      // serverless-container is geen lek.
    }
  }
}
