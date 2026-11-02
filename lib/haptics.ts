// Subtiele haptische feedback bij plaatsen en snappen. Web (Android-browser):
// navigator.vibrate, stil genegeerd waar niet ondersteund. Native app (ook
// iOS, waar navigator.vibrate niet bestaat): echte Taptic/trilmotor via
// @capacitor/haptics, pas bij eerste gebruik geladen (code-splitting).
export function haptic(durationMs = 10): void {
  try {
    if (typeof window !== "undefined" && "Capacitor" in window) {
      void import("@capacitor/haptics")
        .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: durationMs >= 20 ? ImpactStyle.Medium : ImpactStyle.Light }))
        .catch(() => {});
      return;
    }
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(durationMs);
  } catch {
    // Haptiek is nooit kritiek.
  }
}
