// Transcriptie rekent per minuut audio, niet per token — de enige plek in
// dit project waar modelPricing.ts's token-gebaseerde estimateCostUsd niet
// volstaat. Zelfde discipline: prijzen zijn een momentopname (controleer
// https://openai.com/api/pricing bij twijfel), en een onbekend model levert
// bewust 0 op i.p.v. een gok.
export const AUDIO_MODEL_PRICING: Record<string, { perMinuteUsd: number }> = {
  // Gekozen transcriptiemodel (zie TRANSCRIBE_MODEL in openai-client.ts):
  // half de kosten van whisper-1 bij vergelijkbare-of-betere kwaliteit
  // volgens OpenAI's eigen benchmarks — past bij dit project se bestaande
  // "-mini voor kostenbeheersing"-patroon (vgl. CHECK_MODEL).
  "gpt-4o-mini-transcribe": { perMinuteUsd: 0.003 },
  "whisper-1": { perMinuteUsd: 0.006 },
};

export function estimateAudioCostUsd(
  model: string,
  durationSeconds: number,
): number {
  const pricing = AUDIO_MODEL_PRICING[model];
  if (!pricing) return 0;

  return (durationSeconds / 60) * pricing.perMinuteUsd;
}
