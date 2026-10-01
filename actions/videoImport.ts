"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { SUPPORTED_VIDEO_MIME_TYPES, VIDEO_FRAME_MAX_COUNT, VIDEO_MAX_DURATION_SECONDS } from "@/lib/ai/videoTypes";
import { advanceVideoImportJob, type VideoImportResult, type VideoSourceType } from "@/lib/ai/videoImportProcessor";
import { extractYouTubeVideoId, fetchYoutubeVideoMetadata, type YoutubeVideoMetadata } from "@/lib/ai/youtubeMetadata";
import { YOUTUBE_IMPORT_MODE } from "@/lib/ai/youtubeImportMode";

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
 *
 * `url: null` (geen `error`) betekent: de job bestaat en is van deze
 * gebruiker, maar heeft nog geen frame — óf nog geen AI-voorstel (transcript_only
 * heeft er sowieso nooit een), óf frame-selectie is mislukt. VideoFrameReviewBanner
 * toont in dat geval de handmatige-schermafbeelding-upload i.p.v. de banner
 * stil te verbergen (zoals vóór deze wijziging gebeurde) — een genuine fout
 * (job niet gevonden/geen toegang) blijft wél `error`.
 */
export async function getVideoImportFrameUrl(
  jobId: string,
): Promise<{ error: string } | { success: true; url: string | null }> {
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

  if (jobError || !job) {
    return { error: "Verwerkingsstatus niet gevonden." };
  }

  if (!job.selected_frame_path) {
    return { success: true, url: null };
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

/**
 * STAP7/DEEL3-fallback: registreert een door de gebruiker zelf geüploade
 * schermafbeelding (rechtstreeks naar Storage geüpload door de aanroeper,
 * zelfde direct-naar-Storage-patroon) als voorgesteld arrangement-frame.
 * Zodra dit gezet is, gedraagt VideoFrameReviewBanner zich identiek aan een
 * AI-geselecteerd frame — dezelfde 3 keuzes (gebruiken/natekenen/niet
 * gebruiken).
 */
export async function uploadManualReferenceFrame(
  jobId: string,
  storagePath: string,
): Promise<{ error: string } | { success: true }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  if (!storagePath.startsWith(`${user.id}/${jobId}/`)) {
    return { error: "Ongeldig bestandspad." };
  }

  const { error } = await supabase
    .from("video_import_jobs")
    .update({ selected_frame_path: storagePath, frame_selection_failed: false })
    .eq("id", jobId)
    .eq("user_id", user.id);

  if (error) {
    console.error(`video-import[${jobId}]: kon handmatig frame niet registreren:`, error.message);
    return { error: GENERIC_ERROR };
  }

  return { success: true };
}

const DANGLING_JOB_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 uur

/**
 * Zoekt een niet-afgeronde video-import-job van de huidige gebruiker, voor
 * de "doorgaan/annuleren"-banner op het keuzescherm. Video-verwerking is
 * kostbaarder dan de document-upload (verbruikt al een quotum-slot zodra
 * transcriptie start), dus i.t.t. dat pad wordt een gesloten tab hier niet
 * stilzwijgend genegeerd. `sourceType` laat het keuzescherm bepalen welke
 * kaart (bestand of YouTube-link) de hervat-banner moet openen.
 */
export async function findDanglingVideoImportJob(): Promise<
  { jobId: string; sourceType: VideoSourceType } | null
> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const cutoff = new Date(Date.now() - DANGLING_JOB_MAX_AGE_MS).toISOString();

  const { data } = await supabase
    .from("video_import_jobs")
    .select("id, source_type")
    .eq("user_id", user.id)
    .not("status", "in", "(done,failed)")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? { jobId: data.id, sourceType: data.source_type } : null;
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

// ============================================================================
// YouTube-linkinvoer (DEEL1/2 van de brief) — mirrort het bestandsupload-pad
// hierboven, maar zonder bestandsbytes: alleen een URL + de vooraf
// opgehaalde metadata gaan naar de server.
// ============================================================================

export type YoutubePreviewResult =
  | { error: string }
  | { success: true; metadata: YoutubeVideoMetadata; tooLong: boolean };

/**
 * Valideert een geplakte YouTube-link en haalt titel/thumbnail/duur op
 * (YOUTUBE_API_KEY blijft hierdoor altijd server-side — nooit naar de
 * client). `tooLong` wordt teruggegeven i.p.v. als `error` behandeld: de UI
 * toont dan alsnog de bevestigingskaart (titel/thumbnail), maar met de
 * duur-overschrijding duidelijk gemarkeerd en de "Verwerken"-knop uit — dat
 * is duidelijker dan een kale foutmelding zonder te tonen WELKE video het
 * eigenlijk was (STAP-eis: vóór verwerking, met duidelijke melding).
 */
export async function previewYoutubeVideo(url: string): Promise<YoutubePreviewResult> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    return { error: "Dit lijkt geen geldige YouTube-link. Gebruik een youtube.com/watch-, youtu.be- of shorts-link." };
  }

  let metadata: YoutubeVideoMetadata | null;
  try {
    metadata = await fetchYoutubeVideoMetadata(videoId);
  } catch (cause) {
    console.error("previewYoutubeVideo: kon YouTube-metadata niet ophalen:", cause);
    return { error: "Kon deze video niet controleren bij YouTube. Probeer het opnieuw." };
  }

  if (!metadata) {
    return { error: "Deze video is niet gevonden op YouTube (verwijderd, privé, of een onjuiste link)." };
  }

  return { success: true, metadata, tooLong: metadata.durationSeconds > VIDEO_MAX_DURATION_SECONDS };
}

/**
 * Maakt een video_import_jobs-rij aan voor een YouTube-link — geen upload,
 * dus video_storage_path/frame_storage_paths blijven leeg. `source_type`
 * wordt hier, server-side, uit YOUTUBE_IMPORT_MODE afgeleid — NOOIT van de
 * client overgenomen (DEEL2-eis: "niet door de eindgebruiker te kiezen").
 * Alles hier wordt opnieuw server-side gevalideerd (duur, video-ID-formaat)
 * i.p.v. de client-side previewYoutubeVideo-uitkomst te vertrouwen.
 */
export async function createYoutubeImportJob(input: {
  url: string;
}): Promise<CreateJobResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  const videoId = extractYouTubeVideoId(input.url);
  if (!videoId) {
    return { error: "Dit lijkt geen geldige YouTube-link." };
  }
  console.log(`createYoutubeImportJob: video-ID geëxtraheerd uit link: ${videoId}`);

  let metadata: YoutubeVideoMetadata | null;
  try {
    metadata = await fetchYoutubeVideoMetadata(videoId);
  } catch (cause) {
    console.error("createYoutubeImportJob: kon YouTube-metadata niet ophalen:", cause);
    return { error: "Kon deze video niet controleren bij YouTube. Probeer het opnieuw." };
  }

  if (!metadata) {
    return { error: "Deze video is niet gevonden op YouTube (verwijderd, privé, of een onjuiste link)." };
  }

  if (metadata.durationSeconds > VIDEO_MAX_DURATION_SECONDS) {
    return { error: "Deze video is langer dan de toegestane 10 minuten." };
  }

  const sourceType: VideoSourceType =
    YOUTUBE_IMPORT_MODE === "full_auto" ? "youtube_full_auto" : "youtube_transcript_only";

  const { data, error } = await supabase
    .from("video_import_jobs")
    .insert({
      user_id: user.id,
      source_type: sourceType,
      youtube_video_id: videoId,
      youtube_url: input.url,
      original_filename: metadata.title,
      mime_type: "video/mp4",
      duration_seconds: Math.round(metadata.durationSeconds),
      frame_storage_paths: [],
      status: "uploaded",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createYoutubeImportJob: kon job niet aanmaken:", error?.message);
    return { error: GENERIC_ERROR };
  }

  console.log(`video-import[${data.id}]: YouTube-job aangemaakt (${sourceType}, ${metadata.title})`);
  return { success: true, jobId: data.id };
}
