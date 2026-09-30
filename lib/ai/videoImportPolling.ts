import { advanceVideoImportJobAction, getVideoImportJobStatus } from "@/actions/videoImport";
import type { ExtractedActivity } from "@/lib/ai/activityImportExtraction";

// Gedeelde poll-/fase-aandrijflogica — gebruikt door zowel
// VideoImportUploadCard.tsx (bestandsupload) als YoutubeLinkImportCard.tsx
// (YouTube-link, beide modi). Beide kaarten verschillen alleen in HOE een
// job ontstaat (client-side upload+frame-vastlegging vs. een server-actie
// met een URL) — zodra de job-id er is, is het polvoortgangspatroon
// identiek, dus die logica hoort maar op één plek te staan.

export type VideoImportProcessedResult = {
  jobId: string;
  activity: ExtractedActivity | null;
  lowAudioContent: boolean;
};

export type VideoImportPollOutcome =
  | { outcome: "done"; result: VideoImportProcessedResult }
  | { outcome: "failed"; message: string }
  | { outcome: "timeout" }
  | { outcome: "cancelled" };

const COMPLETED_PHASE_STATUSES = new Set(["audio_extracted", "transcribed", "mapped"]);

/**
 * Pollt een video-import-job tot 'done'/'failed'/timeout, en drijft zelf de
 * fasenmachine aan: na elke poll die een fase-overgang laat zien
 * (audio_extracted/transcribed/mapped) roept dit `advanceVideoImportJobAction`
 * opnieuw aan, zodat de volgende fase start. `onStatusChange` laat de
 * aanroepende kaart een passend statuslabel tonen (STAP-eis: per modus een
 * andere melding, bijv. "Ondertiteling ophalen..." vs. "Video wordt
 * gedownload...").
 */
export async function pollVideoImportJob(
  jobId: string,
  options: {
    timeoutMs: number;
    isCancelled: () => boolean;
    onStatusChange: (status: string) => void;
    pollIntervalMs?: number;
  },
): Promise<VideoImportPollOutcome> {
  const pollIntervalMs = options.pollIntervalMs ?? 1500;
  const deadline = Date.now() + options.timeoutMs;
  let lastAdvancedStatus: string | null = null;

  advanceVideoImportJobAction(jobId).catch((cause) => {
    console.error("videoImportPolling: fase-aanroep mislukt:", cause);
  });

  while (!options.isCancelled()) {
    if (Date.now() > deadline) {
      return { outcome: "timeout" };
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    if (options.isCancelled()) return { outcome: "cancelled" };

    const result = await getVideoImportJobStatus(jobId);
    if ("error" in result) {
      return { outcome: "failed", message: result.error };
    }

    if (result.status === "done") {
      return {
        outcome: "done",
        result: {
          jobId,
          activity: result.result?.activity ?? null,
          lowAudioContent: result.lowAudioContent,
        },
      };
    }

    if (result.status === "failed") {
      return { outcome: "failed", message: result.errorMessage ?? "Verwerken is mislukt." };
    }

    options.onStatusChange(result.status);

    if (COMPLETED_PHASE_STATUSES.has(result.status) && result.status !== lastAdvancedStatus) {
      lastAdvancedStatus = result.status;
      advanceVideoImportJobAction(jobId).catch((cause) => {
        console.error("videoImportPolling: fase-aanroep mislukt:", cause);
      });
    }
  }

  return { outcome: "cancelled" };
}
