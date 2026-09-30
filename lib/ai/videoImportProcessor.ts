import type { SupabaseClient } from "@supabase/supabase-js";

import { extractActivityFromText, type ExtractedActivity } from "@/lib/ai/activityImportExtraction";
import { aiMappingUserMessage as sharedAiMappingUserMessage, logAiFailure } from "@/lib/ai/aiErrorMessages";
import { estimateAudioCostUsd } from "@/lib/ai/audioModelPricing";
import { CHECK_MODEL, TRANSCRIBE_MODEL } from "@/lib/ai/openai-client";
import { checkAndRecordAiUsage } from "@/lib/ai/usage";
import { recordAiUsage } from "@/lib/ai/usageTracking";
import { extractCompressedAudio } from "@/lib/ai/videoAudioExtraction";
import { MIN_USEFUL_TRANSCRIPT_CHARS, transcribeAudio } from "@/lib/ai/videoTranscription";
import { pickWinningFrame, scoreCandidateFrames } from "@/lib/ai/videoFrameScoring";

const BUCKET = "activity-video-imports";

const AUDIO_EXTRACTION_ERROR =
  "Kon de audio niet uit deze video halen. Probeer een ander bestand of vul de activiteit handmatig in.";
const TRANSCRIPTION_ERROR =
  "De video kon niet worden getranscribeerd. Probeer het opnieuw of vul de activiteit handmatig in.";
const AI_MAPPING_ERROR =
  "De AI kon de inhoud van deze video niet goed omzetten naar een activiteit. Probeer het opnieuw of vul de activiteit handmatig in.";
const QUOTA_ERROR = "Je hebt je AI-checks voor deze maand gebruikt. Probeer het volgende maand opnieuw.";

export type VideoImportResult = {
  activity: ExtractedActivity | null;
  lowAudioContent: boolean;
  frameSelectionFailed: boolean;
};

function logFailure(jobId: string, stage: string, cause: unknown) {
  logAiFailure(`video-import[${jobId}]`, stage, cause);
}

async function updateJob(supabase: SupabaseClient, jobId: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from("video_import_jobs").update(patch).eq("id", jobId);
  if (error) {
    console.error(`video-import[${jobId}]: kon jobstatus niet bijwerken:`, error.message);
  }
}

async function failJob(
  supabase: SupabaseClient,
  jobId: string,
  stage: "audio_extraction" | "transcription" | "mapping" | "frame_scoring",
  message: string,
) {
  console.error(`video-import[${jobId}]: mislukt in stage=${stage}: ${message}`);
  await updateJob(supabase, jobId, { status: "failed", error_stage: stage, error_message: message });
}

/**
 * Dispatcht naar de fase die bij de huidige jobstatus hoort en voert die
 * ÉÉN fase uit, dan retourneert. De client roept dit na elke poll die een
 * fase-overgang laat zien opnieuw aan — dat houdt elke server-invocatie
 * kort (voorkomt Vercel-serverless-timeouts bij een lange video) en laat
 * elke fase onafhankelijk falen (STAP-eis), i.p.v. één lange aaneengesloten
 * pijplijn die bij de eerste fout alles verliest.
 */
export async function advanceVideoImportJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
): Promise<void> {
  const { data: job, error } = await supabase
    .from("video_import_jobs")
    .select("status")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !job) {
    console.error(`video-import[${jobId}]: job niet gevonden voor advance:`, error?.message);
    return;
  }

  switch (job.status) {
    case "uploaded":
      await runAudioExtractionPhase(supabase, userId, jobId);
      return;
    case "audio_extracted":
      await runTranscriptionPhase(supabase, userId, jobId);
      return;
    case "transcribed":
      await runMappingPhase(supabase, userId, jobId);
      return;
    case "mapped":
      await runFrameScoringPhase(supabase, userId, jobId);
      return;
    default:
      // 'extracting_audio', 'transcribing', 'mapping', 'scoring_frames'
      // (al bezig — een dubbele aanroep terwijl de vorige nog niet
      // geclaimd/afgerond is), of 'done'/'failed' (niets meer te doen).
      return;
  }
}

async function runAudioExtractionPhase(supabase: SupabaseClient, userId: string, jobId: string): Promise<void> {
  const { data: claimed, error: claimError } = await supabase
    .from("video_import_jobs")
    .update({ status: "extracting_audio" })
    .eq("id", jobId)
    .eq("user_id", userId)
    .eq("status", "uploaded")
    .select("video_storage_path, mime_type")
    .maybeSingle();

  if (claimError) {
    console.error(`video-import[${jobId}]: kon job niet claimen (audio-extractie):`, claimError.message);
    return;
  }
  if (!claimed) return;

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(claimed.video_storage_path);

  if (downloadError || !fileBlob) {
    console.error(`video-import[${jobId}]: kon video niet ophalen uit Storage:`, downloadError?.message);
    await failJob(supabase, jobId, "audio_extraction", "Kon de geüploade video niet ophalen. Probeer opnieuw te uploaden.");
    return;
  }

  try {
    const videoBuffer = Buffer.from(await fileBlob.arrayBuffer());
    const audioBuffer = await extractCompressedAudio(videoBuffer, claimed.mime_type);

    if (!audioBuffer) {
      // Geen (bruikbare) audiotrack — geen fout, gewoon door naar de
      // transcriptiefase, die dit overslaat en direct met een lege
      // transcriptie doorgaat (STAP3-eis: stille video valt terug op
      // beeld-alleen).
      console.log(`video-import[${jobId}]: geen audiotrack gevonden — transcriptie wordt overgeslagen.`);
      await updateJob(supabase, jobId, { status: "audio_extracted", low_audio_content: true });
      return;
    }

    const audioPath = `${userId}/${jobId}/audio.mp3`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(audioPath, audioBuffer, { contentType: "audio/mpeg", upsert: true });

    if (uploadError) {
      throw new Error(`kon geëxtraheerde audio niet uploaden: ${uploadError.message}`);
    }

    await updateJob(supabase, jobId, { status: "audio_extracted", audio_storage_path: audioPath });
  } catch (cause) {
    logFailure(jobId, "audio-extractie", cause);
    await failJob(supabase, jobId, "audio_extraction", cause instanceof Error ? cause.message : AUDIO_EXTRACTION_ERROR);
  }
}

async function runTranscriptionPhase(supabase: SupabaseClient, userId: string, jobId: string): Promise<void> {
  const { data: claimed, error: claimError } = await supabase
    .from("video_import_jobs")
    .update({ status: "transcribing" })
    .eq("id", jobId)
    .eq("user_id", userId)
    .eq("status", "audio_extracted")
    .select("audio_storage_path, low_audio_content, duration_seconds")
    .maybeSingle();

  if (claimError) {
    console.error(`video-import[${jobId}]: kon job niet claimen (transcriptie):`, claimError.message);
    return;
  }
  if (!claimed) return;

  // Fair-use-gate: één quotum-slot per verwerkte video, afgeschreven zodra
  // de verwerking hier daadwerkelijk begint — ook als de video geen audio
  // blijkt te hebben (voorkomt dat iemand onbeperkt video's laat verwerken
  // door bewust stille bestanden te uploaden).
  const usage = await checkAndRecordAiUsage(supabase, userId, "video-import");
  if (!usage.allowed) {
    await failJob(supabase, jobId, "transcription", QUOTA_ERROR);
    return;
  }

  if (claimed.low_audio_content || !claimed.audio_storage_path) {
    await updateJob(supabase, jobId, { status: "transcribed", transcript: "" });
    return;
  }

  try {
    const { data: audioBlob, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(claimed.audio_storage_path);

    if (downloadError || !audioBlob) {
      throw new Error(`kon geëxtraheerde audio niet ophalen: ${downloadError?.message ?? "onbekende fout"}`);
    }

    const audioBuffer = Buffer.from(await audioBlob.arrayBuffer());
    const { transcript } = await transcribeAudio(audioBuffer, jobId);

    await recordAiUsage(supabase, {
      userId,
      feature: "activity_video_transcription",
      model: TRANSCRIBE_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      costUsdOverride: estimateAudioCostUsd(TRANSCRIBE_MODEL, claimed.duration_seconds),
    });

    const isLowContent = transcript.trim().length < MIN_USEFUL_TRANSCRIPT_CHARS;
    if (isLowContent) {
      console.log(`video-import[${jobId}]: transcriptie te kort/leeg (${transcript.length} tekens) — terugvallen op beeld-alleen.`);
    }

    await updateJob(supabase, jobId, {
      status: "transcribed",
      transcript,
      low_audio_content: isLowContent,
    });
  } catch (cause) {
    logFailure(jobId, "transcriptie", cause);
    await failJob(supabase, jobId, "transcription", TRANSCRIPTION_ERROR);
  }
}

async function runMappingPhase(supabase: SupabaseClient, userId: string, jobId: string): Promise<void> {
  const { data: claimed, error: claimError } = await supabase
    .from("video_import_jobs")
    .update({ status: "mapping" })
    .eq("id", jobId)
    .eq("user_id", userId)
    .eq("status", "transcribed")
    .select("transcript, low_audio_content")
    .maybeSingle();

  if (claimError) {
    console.error(`video-import[${jobId}]: kon job niet claimen (mapping):`, claimError.message);
    return;
  }
  if (!claimed) return;

  if (claimed.low_audio_content || !claimed.transcript?.trim()) {
    const result: VideoImportResult = { activity: null, lowAudioContent: true, frameSelectionFailed: false };
    await updateJob(supabase, jobId, { status: "mapped", result });
    return;
  }

  try {
    const { activity, inputTokens, outputTokens } = await extractActivityFromText(claimed.transcript, jobId);

    await recordAiUsage(supabase, {
      userId,
      feature: "activity_video_text_extraction",
      model: CHECK_MODEL,
      inputTokens,
      outputTokens,
    });

    if (!activity.isMovementActivity) {
      await failJob(
        supabase,
        jobId,
        "mapping",
        "Deze video lijkt geen bewegingsactiviteit of lesvoorbereiding te bevatten. Controleer het bestand, of vul de activiteit handmatig in.",
      );
      return;
    }

    const result: VideoImportResult = { activity, lowAudioContent: false, frameSelectionFailed: false };
    await updateJob(supabase, jobId, { status: "mapped", result });
  } catch (cause) {
    logFailure(jobId, "AI-mapping", cause);
    await failJob(supabase, jobId, "mapping", sharedAiMappingUserMessage(cause, AI_MAPPING_ERROR));
  }
}

async function runFrameScoringPhase(supabase: SupabaseClient, userId: string, jobId: string): Promise<void> {
  const { data: claimed, error: claimError } = await supabase
    .from("video_import_jobs")
    .update({ status: "scoring_frames" })
    .eq("id", jobId)
    .eq("user_id", userId)
    .eq("status", "mapped")
    .select("frame_storage_paths, result")
    .maybeSingle();

  if (claimError) {
    console.error(`video-import[${jobId}]: kon job niet claimen (frame-scoring):`, claimError.message);
    return;
  }
  if (!claimed) return;

  const existingResult = (claimed.result as VideoImportResult | null) ?? {
    activity: null,
    lowAudioContent: true,
    frameSelectionFailed: false,
  };

  // Frame-scoring faalt ONAFHANKELIJK van de tekst-mapping (STAP-eis): een
  // mislukte/onmogelijke frame-selectie mag het al-bereikte tekstresultaat
  // nooit ongedaan maken — de job wordt dus altijd 'done', nooit 'failed',
  // vanaf hier.
  if (claimed.frame_storage_paths.length === 0) {
    await updateJob(supabase, jobId, {
      status: "done",
      frame_selection_failed: true,
      result: { ...existingResult, frameSelectionFailed: true },
    });
    return;
  }

  try {
    const frames = await Promise.all(
      claimed.frame_storage_paths.map(async (framePath: string, index: number) => {
        const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(framePath);
        if (downloadError || !blob) {
          throw new Error(`kon kandidaat-frame niet ophalen (${framePath}): ${downloadError?.message ?? "onbekende fout"}`);
        }
        const buffer = Buffer.from(await blob.arrayBuffer());
        return { index, path: framePath, dataUrl: `data:image/jpeg;base64,${buffer.toString("base64")}` };
      }),
    );

    const { scores, inputTokens, outputTokens } = await scoreCandidateFrames(
      frames.map(({ index, dataUrl }) => ({ index, dataUrl })),
      jobId,
    );

    await recordAiUsage(supabase, {
      userId,
      feature: "activity_video_frame_scoring",
      model: CHECK_MODEL,
      inputTokens,
      outputTokens,
    });

    const winnerIndex = pickWinningFrame(scores);
    const winnerFrame = winnerIndex !== null ? frames.find((frame) => frame.index === winnerIndex) : null;

    if (!winnerFrame) {
      console.log(`video-import[${jobId}]: geen frame haalde de bruikbaarheidsdrempel — geen afbeelding voorgesteld.`);
      await updateJob(supabase, jobId, {
        status: "done",
        frame_selection_failed: true,
        result: { ...existingResult, frameSelectionFailed: true },
      });
      return;
    }

    await updateJob(supabase, jobId, {
      status: "done",
      selected_frame_path: winnerFrame.path,
      frame_selection_failed: false,
      result: { ...existingResult, frameSelectionFailed: false },
    });
  } catch (cause) {
    // Frame-scoring is bewust NIET een 'failed'-job (zie boven) — een
    // technische fout hier (bijv. OpenAI-storing) degradeert netjes naar
    // "geen afbeelding voorgesteld" i.p.v. het al bereikte tekstresultaat
    // weg te gooien.
    logFailure(jobId, "frame-scoring", cause);
    await updateJob(supabase, jobId, {
      status: "done",
      frame_selection_failed: true,
      result: { ...existingResult, frameSelectionFailed: true },
    });
  }
}
