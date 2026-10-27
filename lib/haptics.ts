// Subtiele haptische feedback (navigator.vibrate) bij plaatsen en snappen, waar
// ondersteund (Android Chrome; iOS Safari ondersteunt het niet — dan gebeurt er niets).
export function haptic(durationMs = 10): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(durationMs);
  } catch {
    // trilling is nooit essentieel
  }
}
