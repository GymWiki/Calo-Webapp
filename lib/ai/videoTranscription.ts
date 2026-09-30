import { toFile } from "openai";
import { getOpenAIClient, TRANSCRIBE_MODEL } from "./openai-client";

export type TranscriptionResult = {
  transcript: string;
};

// Een transcriptie korter dan dit wordt behandeld als "geen bruikbare
// gesproken uitleg" (stille demonstratievideo, of alleen incidentele
// geluiden) — de mapping-fase slaat dan de AI-tekst-extractie over i.p.v.
// een vrijwel lege transcriptie als bron te gebruiken.
export const MIN_USEFUL_TRANSCRIPT_CHARS = 15;

export async function transcribeAudio(
  audioBuffer: Buffer,
  logContext = "onbekend",
): Promise<TranscriptionResult> {
  const client = getOpenAIClient();
  const file = await toFile(audioBuffer, "audio.mp3", { type: "audio/mpeg" });

  try {
    const response = await client.audio.transcriptions.create({
      model: TRANSCRIBE_MODEL,
      file,
      response_format: "json",
    });

    return { transcript: response.text.trim() };
  } catch (error) {
    console.error(`[videoTranscription] transcriptie mislukt (${logContext}):`, error);
    throw error;
  }
}
