"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { FileVideo, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { createVideoImportJob } from "@/actions/videoImport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { estimateAudioCostUsd } from "@/lib/ai/audioModelPricing";
import {
  SUPPORTED_VIDEO_MIME_TYPES,
  VIDEO_FRAME_MAX_COUNT,
  VIDEO_MAX_DURATION_SECONDS,
  VIDEO_MAX_FILE_SIZE_BYTES,
  computeFrameIntervalSeconds,
} from "@/lib/ai/videoTypes";
import { pollVideoImportJob, type VideoImportProcessedResult } from "@/lib/ai/videoImportPolling";
import { createClient } from "@/utils/supabase/client";

const ACCEPT = ".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm";
const BUCKET = "activity-video-imports";
// Video-verwerking doorloopt meerdere fasen (ffmpeg + transcriptie +
// AI-mapping + frame-beoordeling) — ruimer dan het document-pad se 90s.
const POLL_TIMEOUT_MS = 5 * 60_000;
// Kandidaat-frames worden geschaald naar deze maximale breedte vóór upload —
// de AI-beoordeling gebruikt toch detail:"low" (vaste ~85 tokens/beeld,
// ongeacht resolutie), dus een hoge resolutie kost alleen extra upload-tijd/
// -opslag zonder enig voordeel.
const FRAME_MAX_WIDTH = 640;

type Phase = "idle" | "validating" | "uploading" | "processing";

const PROCESSING_LABELS: Record<string, string> = {
  uploaded: "Video wordt verwerkt... dit kan een paar minuten duren",
  extracting_audio: "Audio wordt geëxtraheerd...",
  audio_extracted: "Audio wordt geëxtraheerd...",
  transcribing: "Video wordt getranscribeerd...",
  transcribed: "Video wordt getranscribeerd...",
  mapping: "Tekst wordt geanalyseerd...",
  mapped: "Tekst wordt geanalyseerd...",
  scoring_frames: "Beste overzichtsframe wordt gekozen...",
};

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 100 ? cleaned.slice(-100) : cleaned;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function loadVideoMetadata(file: File): Promise<{ video: HTMLVideoElement; url: string; duration: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = url;
    video.onloadedmetadata = () => resolve({ video, url, duration: video.duration });
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Kon de video niet lezen. Is dit een geldig videobestand?"));
    };
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    function onSeeked() {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    }
    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
  });
}

/**
 * Legt kandidaat-overzichtsframes client-side vast (canvas drawImage/toBlob)
 * op een vast interval — geen server-side ffmpeg nodig voor deze stap, en
 * geen CORS/taint-risico omdat de video een lokaal `File`-object is (via
 * URL.createObjectURL). Zie lib/ai/videoTypes.ts's
 * computeFrameIntervalSeconds voor de interval-/aantal-berekening.
 */
async function captureCandidateFrames(video: HTMLVideoElement, duration: number): Promise<Blob[]> {
  const interval = computeFrameIntervalSeconds(duration);
  const timestamps: number[] = [];
  for (let t = 0; t < duration && timestamps.length < VIDEO_FRAME_MAX_COUNT; t += interval) {
    timestamps.push(t);
  }

  const scale = Math.min(1, FRAME_MAX_WIDTH / (video.videoWidth || FRAME_MAX_WIDTH));
  const width = Math.max(1, Math.round((video.videoWidth || FRAME_MAX_WIDTH) * scale));
  const height = Math.max(1, Math.round((video.videoHeight || FRAME_MAX_WIDTH * 0.5625) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  const blobs: Blob[] = [];
  for (const timestamp of timestamps) {
    await seekTo(video, timestamp);
    ctx.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    if (blob) blobs.push(blob);
  }
  return blobs;
}

const DEFAULT_DESCRIPTION =
  "MP4, MOV of WebM — we halen de gesproken uitleg en een overzichtsframe van de opstelling " +
  "automatisch uit de video en zetten dat om naar een ingevuld activiteitformulier.";

/**
 * "Activiteit uit video"-upload: mirror van ActivityImportUploadCard's
 * direct-naar-Storage-architectuur, uitgebreid met client-side duur-/
 * grootte-validatie vóór upload en client-side frame-extractie. Verwerking
 * is een gefaseerde job (zie videoImportProcessor.ts) — deze component
 * drijft de voortgang zelf aan door na elke poll die een fase-overgang laat
 * zien, opnieuw advanceVideoImportJobAction aan te roepen.
 */
export function VideoImportUploadCard({
  onProcessed,
  description = DEFAULT_DESCRIPTION,
  resumeJobId,
}: {
  onProcessed: (result: VideoImportProcessedResult) => void;
  description?: string;
  /** Hervat een eerder aangemaakte, nog niet afgeronde job (zie
   *  findDanglingVideoImportJob) — slaat file-selectie/upload over en
   *  begint direct met pollen/de fasen aandrijven. */
  resumeJobId?: string;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>(resumeJobId ? "processing" : "idle");
  const [statusLabel, setStatusLabel] = useState<string>(
    resumeJobId ? "Verwerking wordt hervat..." : "Video wordt geüpload...",
  );
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!resumeJobId) return;
    void pollAndAdvance(resumeJobId).finally(() => {
      if (!cancelledRef.current) setPhase("idle");
    });
    // Bewust alleen bij mount: resumeJobId wisselt na het eerste render nooit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeJobId]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(null);
    setDuration(null);
    if (!file) return;

    if (!(SUPPORTED_VIDEO_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Alleen MP4, MOV en WebM-video's worden ondersteund.");
      event.target.value = "";
      return;
    }

    if (file.size > VIDEO_MAX_FILE_SIZE_BYTES) {
      toast.error(`Video is te groot (max ${Math.round(VIDEO_MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB).`);
      event.target.value = "";
      return;
    }

    setPhase("validating");
    try {
      const { url, duration: videoDuration } = await loadVideoMetadata(file);
      URL.revokeObjectURL(url);

      if (videoDuration > VIDEO_MAX_DURATION_SECONDS) {
        toast.error(
          `Video is langer dan de toegestane ${Math.round(VIDEO_MAX_DURATION_SECONDS / 60)} minuten ` +
            `(deze video: ${formatDuration(videoDuration)}).`,
        );
        event.target.value = "";
        setPhase("idle");
        return;
      }

      setSelectedFile(file);
      setDuration(videoDuration);
      setPhase("idle");
    } catch (cause) {
      console.error("VideoImportUploadCard: kon videometadata niet lezen:", cause);
      toast.error("Kon de video niet lezen. Is dit een geldig videobestand?");
      event.target.value = "";
      setPhase("idle");
    }
  }

  async function pollAndAdvance(jobId: string): Promise<void> {
    const outcome = await pollVideoImportJob(jobId, {
      timeoutMs: POLL_TIMEOUT_MS,
      isCancelled: () => cancelledRef.current,
      onStatusChange: (status) => setStatusLabel(PROCESSING_LABELS[status] ?? PROCESSING_LABELS.uploaded),
    });

    if (outcome.outcome === "done") {
      onProcessed(outcome.result);
    } else if (outcome.outcome === "failed") {
      toast.error(outcome.message);
    } else if (outcome.outcome === "timeout") {
      toast.error("Verwerken duurt langer dan verwacht. Probeer het opnieuw of vul de activiteit handmatig in.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile || duration === null) return;

    const form = event.currentTarget;
    setPhase("uploading");
    setStatusLabel("Overzichtsframes worden vastgelegd...");

    let videoElement: HTMLVideoElement | null = null;
    let objectUrl: string | null = null;

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Je bent niet ingelogd.");
        setPhase("idle");
        return;
      }

      const loaded = await loadVideoMetadata(selectedFile);
      videoElement = loaded.video;
      objectUrl = loaded.url;
      const frameBlobs = await captureCandidateFrames(videoElement, duration);

      const uploadId = crypto.randomUUID();
      const videoStoragePath = `${user.id}/${uploadId}/${sanitizeFileName(selectedFile.name)}`;

      setStatusLabel("Video wordt geüpload...");
      const { error: videoUploadError } = await supabase.storage
        .from(BUCKET)
        .upload(videoStoragePath, selectedFile, { contentType: selectedFile.type, upsert: false });

      if (videoUploadError) {
        console.error("VideoImportUploadCard: video-upload mislukt:", videoUploadError.message);
        toast.error("Video kon niet worden geüpload, controleer je verbinding of probeer een kleiner bestand.");
        setPhase("idle");
        return;
      }

      const frameStoragePaths: string[] = [];
      for (let i = 0; i < frameBlobs.length; i++) {
        const framePath = `${user.id}/${uploadId}/frame-${i}.jpg`;
        const { error: frameUploadError } = await supabase.storage
          .from(BUCKET)
          .upload(framePath, frameBlobs[i], { contentType: "image/jpeg", upsert: false });
        if (!frameUploadError) frameStoragePaths.push(framePath);
      }

      const jobResult = await createVideoImportJob({
        videoStoragePath,
        originalFilename: selectedFile.name,
        mimeType: selectedFile.type,
        durationSeconds: duration,
        frameStoragePaths,
      });

      if ("error" in jobResult) {
        toast.error(jobResult.error);
        await supabase.storage.from(BUCKET).remove([videoStoragePath, ...frameStoragePaths]);
        setPhase("idle");
        return;
      }

      setPhase("processing");
      setStatusLabel(PROCESSING_LABELS.uploaded);
      setSelectedFile(null);
      setDuration(null);
      form.reset();

      await pollAndAdvance(jobResult.jobId);
    } catch (cause) {
      console.error("VideoImportUploadCard: onverwachte fout:", cause);
      const detail = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
      toast.error(`Uploaden is mislukt. (${detail})`);
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (!cancelledRef.current) {
        setPhase("idle");
      }
    }
  }

  const isBusy = phase !== "idle";
  const estimatedCost =
    duration !== null ? estimateAudioCostUsd("gpt-4o-mini-transcribe", duration) + 0.001 : null;

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileVideo className="size-4 text-primary" aria-hidden="true" />
          <CardTitle className="text-base">Upload een instructievideo</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
        <p className="text-xs text-muted-foreground">
          Max {Math.round(VIDEO_MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB, max{" "}
          {Math.round(VIDEO_MAX_DURATION_SECONDS / 60)} minuten.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {resumeJobId ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {statusLabel}
          </p>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="file"
                accept={ACCEPT}
                onChange={handleFileChange}
                disabled={isBusy}
                className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
              <Button type="submit" variant="outline" disabled={!selectedFile || isBusy}>
                {phase === "validating" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Video wordt gecontroleerd...
                  </>
                ) : phase === "uploading" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {statusLabel}
                  </>
                ) : phase === "processing" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {statusLabel}
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Uploaden
                  </>
                )}
              </Button>
            </form>
            {selectedFile && duration !== null && estimatedCost !== null && (
              <p className="text-xs text-muted-foreground">
                {selectedFile.name} — {formatDuration(duration)}. Geschatte AI-kosten: ~$
                {estimatedCost.toFixed(3)}.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
