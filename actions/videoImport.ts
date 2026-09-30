"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { SUPPORTED_VIDEO_MIME_TYPES, VIDEO_FRAME_MAX_COUNT, VIDEO_MAX_DURATION_SECONDS } from "@/lib/ai/videoTypes";
import { advanceVideoImportJob, type VideoImportResult } from "@/lib/ai/videoImportProcessor";

// Zelfde direct-naar-Storage-architectuur als actions/activityImport.ts
// (zie de uitgebreide toelichting daar): de video + client-side vastgelegde
// kandidaat-frames gaan rechtstreeks van de browser naar Supabase Storage,
// deze acties ontvangen alleen storage-paden — nooit bestandsbytes.

const GENERIC_ERROR = "Er is iets misgegaan. Probeer het opnieuw.";

type CreateJobResult = { error: string } | { success: true; jobId: string };

/**
 * Registreert een al-geüpload video (+ al-geüploade kandidaat-frames) als
 * verwerkingsjob. Doet zelf geen AI-aanroep en dus geen quotumcheck — dat
 * gebeurt pas in de transcriptiefase (videoImportProcessor.ts), vlak vóór
 * de eerste echte AI-kosten, zodat een video die uiteindelijk niet bruikbaar
 * blijkt nooit een quotum-slot verbruikt vóór er iets geprobeerd is.
 */
export async function createVideoImportJob(input: {
  videoStoragePath: string;
  originalFilename: string;
  mimeType: string;
  durationSeconds: number;
  frameStoragePaths: string[];
}): Promise<CreateJobResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  if (!(SUPPORTED_VIDEO_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    return { error: "Alleen MP4, MOV en WebM-video's worden ondersteund." };
  }

  if (input.durationSeconds > VIDEO_MAX_DURATION_SECONDS) {
    return { error: "Deze video is langer dan de toegestane 10 minuten." };
  }

  if (input.frameStoragePaths.length > VIDEO_FRAME_MAX_COUNT) {
    return { error: "Te veel kandidaat-frames aangeleverd." };
  }

  // De storage-paden horen te beginnen met de eigen user id — zo niet, dan
  // zou het aanmaken van het bestand hoe dan ook al op RLS zijn afgeketst,
  // maar deze check geeft een duidelijkere foutmelding dan een kale
  // Postgres-foutcode als hier ooit een verzonnen path binnenkomt.
  const ownPrefix = `${user.id}/`;
  if (
    !input.videoStoragePath.startsWith(ownPrefix) ||
    input.frameStoragePaths.some((path) => !path.startsWith(ownPrefix))
  ) {
    return { error: "Ongeldig bestandspad." };
  }

  const { data, error } = await supabase
    .from("video_import_jobs")
    .insert({
      user_id: user.id,
      video_storage_path: input.videoStoragePath,
      original_filename: input.originalFilename,
      mime_type: input.mimeType,
      duration_seconds: Math.round(input.durationSeconds),
      frame_storage_paths: input.frameStoragePaths,
      status: "uploaded",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createVideoImportJob: kon job niet aanmaken:", error?.message);
    return { error: GENERIC_ERROR };
  }

  console.log(`video-import[${data.id}]: job aangemaakt (${input.originalFilename})`);
  return { success: true, jobId: data.id };
}

/**
 * Zet de job één fase verder (zie advanceVideoImportJob). De client wacht
 * dit resultaat niet af en roept 'm na elke poll die een fase-overgang
 * laat zien opnieuw aan — dat houdt elke server-invocatie kort.
 */
export async function advanceVideoImportJobAction(
  jobId: string,
): Promise<{ error: string } | { success: true }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  await advanceVideoImportJob(supabase, user.id, jobId);
  return { success: true };
}

export type VideoImportJobStatus = {
  status:
    | "uploaded"
    | "extracting_audio"
    | "audio_extracted"
    | "transcribing"
    | "transcribed"
    | "mapping"
    | "mapped"
    | "scoring_frames"
    | "done"
    | "failed";
  errorStage: "audio_extraction" | "transcription" | "mapping" | "frame_scoring" | null;
  errorMessage: string | null;
  lowAudioContent: boolean;
  result: VideoImportResult | null;
};

export async function getVideoImportJobStatus(
  jobId: string,
): Promise<{ error: string } | ({ success: true } & VideoImportJobStatus)> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  const { data, error } = await supabase
    .from("video_import_jobs")
    .select("status, error_stage, error_message, low_audio_content, result")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return { error: "Verwerkingsstatus niet gevonden." };
  }

  return {
    success: true,
    status: data.status,
    errorStage: data.error_stage,
    errorMessage: data.error_message,
    lowAudioContent: data.low_audio_content,
    result: data.result,
  };
}

const FRAME_URL_EXPIRY_SECONDS = 60 * 60; // 1 uur

/**
 * Ondertekent het gekozen videoframe opnieuw bij ELKE aanroep — niet één
 * keer cachen bij job-voltooiing, want de gebruiker kan pas veel later (na
 * de rest van het formulier in te vullen) op de review-banner klikken, ruim
 * na het verlopen van een eerder ondertekende URL.
 */
export async function getVideoImportFrameUrl(
  jobId: string,
): Promise<{ error: string } | { success: true; url: string }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  const { data: job, error: jobError } = await supabase
    .from("video_import_jobs")
    .select("selected_frame_path")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (jobError || !job?.selected_frame_path) {
    return { error: "Geen voorgesteld videoframe gevonden." };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("activity-video-imports")
    .createSignedUrl(job.selected_frame_path, FRAME_URL_EXPIRY_SECONDS);

  if (signError || !signed) {
    console.error(`video-import[${jobId}]: kon frame-URL niet ondertekenen:`, signError?.message);
    return { error: GENERIC_ERROR };
  }

  return { success: true, url: signed.signedUrl };
}

const DANGLING_JOB_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 uur

/**
 * Zoekt een niet-afgeronde video-import-job van de huidige gebruiker, voor
 * de "doorgaan/annuleren"-banner op het keuzescherm. Video-verwerking is
 * kostbaarder dan de document-upload (verbruikt al een quotum-slot zodra
 * transcriptie start), dus i.t.t. dat pad wordt een gesloten tab hier niet
 * stilzwijgend genegeerd.
 */
export async function findDanglingVideoImportJob(): Promise<{ jobId: string } | null> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const cutoff = new Date(Date.now() - DANGLING_JOB_MAX_AGE_MS).toISOString();

  const { data } = await supabase
    .from("video_import_jobs")
    .select("id")
    .eq("user_id", user.id)
    .not("status", "in", "(done,failed)")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? { jobId: data.id } : null;
}

/**
 * Annuleert een hangende job (de "Annuleren"-keuze op de dangling-job-
 * banner) — markeert 'm als failed zodat findDanglingVideoImportJob 'm
 * niet opnieuw oppikt. Ruimt bewust geen Storage-bestanden op (zie de
 * bekende, uitgestelde cleanup-vervolgstap in het eindrapport).
 */
export async function cancelVideoImportJob(jobId: string): Promise<{ error: string } | { success: true }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  const { error } = await supabase
    .from("video_import_jobs")
    .update({ status: "failed", error_stage: null, error_message: "Geannuleerd door gebruiker." })
    .eq("id", jobId)
    .eq("user_id", user.id);

  if (error) {
    console.error(`video-import[${jobId}]: kon job niet annuleren:`, error.message);
    return { error: GENERIC_ERROR };
  }

  return { success: true };
}
