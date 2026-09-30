"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Link2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { createYoutubeImportJob, previewYoutubeVideo } from "@/actions/videoImport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { YoutubeVideoMetadata } from "@/lib/ai/youtubeMetadata";
import { pollVideoImportJob, type VideoImportProcessedResult } from "@/lib/ai/videoImportPolling";
import { VIDEO_MAX_DURATION_SECONDS } from "@/lib/ai/videoTypes";

// Video-verwerking doorloopt meerdere fasen — zelfde ruime timeout als het
// bestandsupload-pad (VideoImportUploadCard.tsx).
const POLL_TIMEOUT_MS = 5 * 60_000;

// De client kent de actieve YOUTUBE_IMPORT_MODE niet rechtstreeks (die
// blijft bewust server-side, zie lib/ai/youtubeImportMode.ts) — maar de
// fasenmachine (videoImportProcessor.ts) maakt het verschil zelf al
// zichtbaar in de statusovergangen: transcript_only springt van 'uploaded'
// DIRECT naar 'transcribing' (geen download/audio-extractie-fasen),
// full_auto doorloopt eerst 'extracting_audio'/'audio_extracted'. Zodra die
// laatste twee statussen voorbijkomen, weten we dus dat dit full_auto is en
// tonen we vanaf dat moment de bijpassende (langere-wachttijd-)labels.
const TRANSCRIPT_ONLY_LABELS: Record<string, string> = {
  uploaded: "Ondertiteling wordt opgehaald...",
  transcribing: "Ondertiteling wordt opgehaald...",
  transcribed: "Ondertiteling verwerkt...",
  mapping: "Tekst wordt geanalyseerd...",
  mapped: "Tekst wordt geanalyseerd...",
  scoring_frames: "Bijna klaar...",
};

const FULL_AUTO_LABELS: Record<string, string> = {
  uploaded: "Video wordt gedownload en verwerkt... dit kan langer duren",
  extracting_audio: "Video wordt gedownload en verwerkt... dit kan langer duren",
  audio_extracted: "Audio wordt geëxtraheerd...",
  transcribing: "Video wordt getranscribeerd...",
  transcribed: "Video wordt getranscribeerd...",
  mapping: "Tekst wordt geanalyseerd...",
  mapped: "Tekst wordt geanalyseerd...",
  scoring_frames: "Beste overzichtsframe wordt gekozen...",
};

const FULL_AUTO_ONLY_STATUSES = new Set(["extracting_audio", "audio_extracted"]);

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Phase = "idle" | "checking" | "processing";

const DEFAULT_DESCRIPTION =
  "Plak een YouTube-link — we halen de ondertiteling (of, indien ingesteld, de volledige video) op en " +
  "zetten dat om naar een ingevuld activiteitformulier.";

/**
 * YouTube-linkinvoer naast de bestandsupload (VideoImportUploadCard.tsx) —
 * zie lib/ai/youtubeImportMode.ts voor de twee modi die hierachter zitten.
 * Deze kaart weet zelf niet welke modus actief is (bewust server-side
 * gehouden); ze toont alleen een bevestigingskaart (titel/thumbnail/duur)
 * vóór verwerking en pollt daarna, met labels die zich aanpassen zodra de
 * fasenmachine laat zien welke modus daadwerkelijk draait.
 */
export function YoutubeLinkImportCard({
  onProcessed,
  description = DEFAULT_DESCRIPTION,
  resumeJobId,
}: {
  onProcessed: (result: VideoImportProcessedResult) => void;
  description?: string;
  /** Hervat een eerder aangemaakte, nog niet afgeronde YouTube-job (zie
   *  findDanglingVideoImportJob). */
  resumeJobId?: string;
}) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<YoutubeVideoMetadata | null>(null);
  const [tooLong, setTooLong] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(resumeJobId ? "processing" : "idle");
  const [statusLabel, setStatusLabel] = useState(resumeJobId ? "Verwerking wordt hervat..." : "");
  const cancelledRef = useRef(false);
  const isFullAutoRef = useRef(false);

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

  async function pollAndAdvance(jobId: string): Promise<void> {
    isFullAutoRef.current = false;

    const outcome = await pollVideoImportJob(jobId, {
      timeoutMs: POLL_TIMEOUT_MS,
      isCancelled: () => cancelledRef.current,
      onStatusChange: (status) => {
        if (FULL_AUTO_ONLY_STATUSES.has(status)) isFullAutoRef.current = true;
        const labels = isFullAutoRef.current ? FULL_AUTO_LABELS : TRANSCRIPT_ONLY_LABELS;
        setStatusLabel(labels[status] ?? "Video wordt verwerkt...");
      },
    });

    if (outcome.outcome === "done") {
      if (!outcome.result.activity && outcome.result.lowAudioContent) {
        toast.info("Geen ondertiteling gevonden voor deze video. Vul de activiteit hieronder zelf aan.");
      }
      onProcessed(outcome.result);
    } else if (outcome.outcome === "failed") {
      toast.error(outcome.message);
    } else if (outcome.outcome === "timeout") {
      toast.error("Verwerken duurt langer dan verwacht. Probeer het opnieuw of vul de activiteit handmatig in.");
    }
  }

  async function handleCheck() {
    if (!url.trim()) return;
    setPreview(null);
    setPreviewError(null);
    setPhase("checking");

    try {
      const result = await previewYoutubeVideo(url.trim());
      if ("error" in result) {
        setPreviewError(result.error);
        return;
      }
      setPreview(result.metadata);
      setTooLong(result.tooLong);
    } catch (cause) {
      console.error("YoutubeLinkImportCard: preview mislukt:", cause);
      setPreviewError("Kon deze video niet controleren. Probeer het opnieuw.");
    } finally {
      setPhase("idle");
    }
  }

  async function handleProcess() {
    if (!preview || tooLong) return;
    setPhase("processing");
    setStatusLabel("Video wordt gecontroleerd...");

    try {
      const jobResult = await createYoutubeImportJob({ url: url.trim() });
      if ("error" in jobResult) {
        toast.error(jobResult.error);
        setPhase("idle");
        return;
      }

      setUrl("");
      setPreview(null);
      await pollAndAdvance(jobResult.jobId);
    } catch (cause) {
      console.error("YoutubeLinkImportCard: verwerking starten mislukt:", cause);
      toast.error("Verwerken kon niet worden gestart. Probeer het opnieuw.");
    } finally {
      if (!cancelledRef.current) setPhase("idle");
    }
  }

  const isBusy = phase !== "idle";

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-primary" aria-hidden="true" />
          <CardTitle className="text-base">YouTube-link plakken</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {resumeJobId ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {statusLabel}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                type="url"
                inputMode="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setPreview(null);
                  setPreviewError(null);
                }}
                disabled={isBusy}
              />
              <Button type="button" variant="outline" onClick={handleCheck} disabled={!url.trim() || isBusy}>
                {phase === "checking" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Controleren
              </Button>
            </div>

            {previewError && <p className="text-sm text-destructive">{previewError}</p>}

            {preview && (
              <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
                <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-md bg-muted">
                  {preview.thumbnailUrl && (
                    <Image src={preview.thumbnailUrl} alt="" fill className="object-cover" unoptimized />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{preview.title}</p>
                  <p className={`text-xs ${tooLong ? "text-destructive" : "text-muted-foreground"}`}>
                    {formatDuration(preview.durationSeconds)}
                    {tooLong &&
                      ` — langer dan de toegestane ${Math.round(VIDEO_MAX_DURATION_SECONDS / 60)} minuten`}
                  </p>
                </div>
                <Button type="button" size="sm" onClick={handleProcess} disabled={tooLong || isBusy}>
                  {phase === "processing" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {statusLabel}
                    </>
                  ) : (
                    "Verwerken"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
