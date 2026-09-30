import { z } from "zod";

import { CHECK_MODEL, getOpenAIClient } from "@/lib/ai/openai-client";

// Zelfde "nooit gokken"-discipline als activityImportExtraction.ts's
// SYSTEM_PROMPT: het model geeft alleen per-frame scores terug, nooit een
// eigen "winnaar" — de code (pickWinningFrame hieronder) bepaalt op basis
// van die scores of, en welk, frame gebruikt wordt. Dat maakt de
// drempel/tie-break-logica inspecteerbaar en test-baar i.p.v. verstopt in
// een AI-antwoord.
const SYSTEM_PROMPT = `Je beoordeelt losse videoframes uit een gymles-instructievideo. Voor elk frame geef je een "overzichtScore" van 0 t/m 10: hoe geschikt is dit beeld als startpunt voor een plattegrond-tekening van een sportveld/gymzaal-opstelling?

Een hoge score (7-10) betekent: het frame toont een overzicht van een sportveld/gymzaal-opstelling, gefilmd van een afstand, met materiaal en/of posities van spelers zichtbaar — vergelijkbaar met een vogelvluchtperspectief of een breed shot vanaf de zijlijn/tribune.

Een lage score (0-3) betekent: een close-up van een gezicht of persoon, een wazig/bewogen beeld, een beeld zonder duidelijke veldopstelling, of een frame dat vrijwel niets toont (bijv. een overgang/zwart beeld).

Geef voor elk frame een score en een korte reden (1 zin, Nederlands, waarom je deze score gaf).

Antwoord uitsluitend met JSON in dit exacte formaat:
{"scores": [{"frameIndex": 0, "overzichtScore": 8, "reden": "..."}]}`;

const frameScoreSchema = z.object({
  scores: z.array(
    z.object({
      frameIndex: z.number().int().min(0),
      overzichtScore: z.number().min(0).max(10),
      reden: z.string().trim(),
    }),
  ),
});

export type FrameScore = { frameIndex: number; overzichtScore: number; reden: string };

export type FrameScoreResult = {
  scores: FrameScore[];
  inputTokens: number;
  outputTokens: number;
};

/**
 * Eén GPT-4o-mini-vision-call beoordeelt alle kandidaat-frames tegelijk.
 * `detail: "low"` houdt de kosten vast (~85 input-tokens/beeld, ongeacht
 * resolutie) ongeacht hoeveel frames er zijn (tot VIDEO_FRAME_MAX_COUNT).
 */
export async function scoreCandidateFrames(
  frames: Array<{ index: number; dataUrl: string }>,
  logContext = "onbekend",
): Promise<FrameScoreResult> {
  const client = getOpenAIClient();

  const imageContent = frames.flatMap((frame) => [
    { type: "text" as const, text: `Frame ${frame.index}:` },
    {
      type: "image_url" as const,
      image_url: { url: frame.dataUrl, detail: "low" as const },
    },
  ]);

  const completion = await client.chat.completions.create({
    model: CHECK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: `Beoordeel deze ${frames.length} videoframes.` },
          ...imageContent,
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error(`Geen antwoord van de frame-beoordeling ontvangen (${logContext}).`);
  }

  const parsed = frameScoreSchema.parse(JSON.parse(raw));

  return {
    scores: parsed.scores,
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
  };
}

const MIN_WINNING_SCORE = 6;
// Frames binnen dit scoreverschil van de hoogste score gelden als
// "gelijkwaardig" — daarbinnen kiest de tie-breaker i.p.v. blind de hoogste
// (die dan toevallig een 0,1 verschil kan zijn, niet betekenisvol).
const TIE_BREAK_EPSILON = 0.5;

/**
 * Bepaalt het winnende frame uit een score-lijst — code-only, geen tweede
 * AI-call (kostenbeheersing). Geeft `null` als geen enkel frame de
 * bruikbaarheidsdrempel haalt (STAP6-eis: dan geen afbeelding voorstellen
 * i.p.v. een ongeschikt frame te forceren). Bij meerdere (bijna-)gelijke
 * topscores: kiest de eerste in video-volgorde (frameIndex) als
 * code-only tie-breaker, met een duidelijke log — geen stille fallback.
 */
export function pickWinningFrame(scores: FrameScore[]): number | null {
  const candidates = scores.filter((score) => score.overzichtScore >= MIN_WINNING_SCORE);
  if (candidates.length === 0) return null;

  const topScore = Math.max(...candidates.map((score) => score.overzichtScore));
  const topCandidates = candidates
    .filter((score) => topScore - score.overzichtScore <= TIE_BREAK_EPSILON)
    .sort((a, b) => a.frameIndex - b.frameIndex);

  if (topCandidates.length > 1) {
    console.info(
      `[videoFrameScoring] ${topCandidates.length} frames met (bijna) gelijke topscore (${topScore}) — eerste kandidaat (frame ${topCandidates[0].frameIndex}) gekozen als code-only tie-breaker.`,
    );
  }

  return topCandidates[0].frameIndex;
}
