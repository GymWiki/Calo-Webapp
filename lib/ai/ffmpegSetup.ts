import { chmodSync, existsSync } from "node:fs";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffmpegLib from "fluent-ffmpeg";

// Gedeelde ffmpeg-initialisatie voor videoAudioExtraction.ts (audio-
// extractie, bestandsupload-pad) en videoFrameExtraction.ts (server-side
// frame-extractie, YouTube full_auto-pad) — één plek voor het pad-/
// permissie-setup i.p.v. de imperatieve module-load-side-effect in elk
// bestand apart te herhalen.
ffmpegLib.setFfmpegPath(ffmpegInstaller.path);
try {
  if (existsSync(ffmpegInstaller.path)) {
    chmodSync(ffmpegInstaller.path, 0o755);
  }
} catch {
  // Best-effort — als dit faalt, faalt de eerste echte ffmpeg-aanroep
  // vanzelf met een duidelijke fout.
}

export const ffmpeg = ffmpegLib;
