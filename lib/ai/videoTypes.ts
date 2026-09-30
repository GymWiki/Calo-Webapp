// Lichte constanten voor "Activiteit uit video" — mirror van
// documentTypes.ts: geen zware afhankelijkheden, veilig te importeren in
// "use server"-bestanden en client-componenten (bestandsgrootte-/
// duurvalidatie moet client-side, vóór upload, kunnen draaien).
export const SUPPORTED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export const VIDEO_MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB
export const VIDEO_MAX_DURATION_SECONDS = 10 * 60; // 10 minuten

// Kandidaat-frames worden client-side vastgelegd op een vast interval,
// begrensd op maximaal VIDEO_FRAME_MAX_COUNT stuks (kosten/tijd voor de
// AI-beoordelingsstap in videoFrameScoring.ts) — bij een korte video dus
// vaker een frame dan bij een lange.
export const VIDEO_FRAME_MAX_COUNT = 20;
export const VIDEO_FRAME_MIN_INTERVAL_SECONDS = 4;

export function computeFrameIntervalSeconds(durationSeconds: number): number {
  return Math.max(
    VIDEO_FRAME_MIN_INTERVAL_SECONDS,
    durationSeconds / VIDEO_FRAME_MAX_COUNT,
  );
}
