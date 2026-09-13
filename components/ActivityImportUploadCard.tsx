"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  createActivityImportJob,
  getActivityImportJobStatus,
  processActivityImportJob,
} from "@/actions/activityImport";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DOCUMENT_MAX_FILE_SIZE_BYTES, SUPPORTED_DOCUMENT_MIME_TYPES } from "@/lib/ai/documentTypes";
import { createClient } from "@/utils/supabase/client";
import type { ExtractedActivity } from "@/lib/ai/activityImportExtraction";

const ACCEPT =
  ".pdf,.docx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain";

const BUCKET = "activity-imports";
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 90_000;

const DEFAULT_DESCRIPTION =
  "PDF, Word (.docx), PowerPoint (.pptx) of tekstbestand — de AI zet het om naar het " +
  "formulier hieronder, zodat je het alleen nog hoeft te controleren vóór je indient. " +
  "Liever alles zelf intypen? Dat kan ook gewoon, hieronder.";

type Phase = "idle" | "uploading" | "processing";

const PROCESSING_LABELS: Record<string, string> = {
  uploaded: "Bestand wordt verwerkt...",
  extracting: "Tekst wordt uitgelezen...",
  mapping: "AI zet dit om naar een activiteit...",
};

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 100 ? cleaned.slice(-100) : cleaned;
}

/**
 * Herbouwde upload-flow (zie actions/activityImport.ts voor de volledige
 * uitleg van waarom): het bestand gaat rechtstreeks van de browser naar
 * Supabase Storage — nooit meer als request-body naar een Vercel-functie —
 * waarna een lichte server-actie alleen de storage-path krijgt om de
 * verwerking (tekstextractie + AI-mapping) te starten. Verwerking gebeurt
 * asynchroon; deze component pollt de jobstatus totdat die klaar (of
 * mislukt) is.
 */
export function ActivityImportUploadCard({
  onExtracted,
  description = DEFAULT_DESCRIPTION,
}: {
  onExtracted: (activity: ExtractedActivity) => void;
  description?: string;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusLabel, setStatusLabel] = useState<string>("Bestand wordt geüpload...");
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  async function pollJobStatus(jobId: string): Promise<void> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (!cancelledRef.current) {
      if (Date.now() > deadline) {
        toast.error(
          "Verwerken duurt langer dan verwacht. Probeer het opnieuw of vul de activiteit handmatig in.",
        );
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      if (cancelledRef.current) return;

      const result = await getActivityImportJobStatus(jobId);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (result.status === "done") {
        if (result.result) {
          onExtracted(result.result);
        }
        return;
      }

      if (result.status === "failed") {
        toast.error(result.errorMessage ?? "Verwerken van dit bestand is mislukt.");
        return;
      }

      setStatusLabel(PROCESSING_LABELS[result.status] ?? PROCESSING_LABELS.uploaded);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) return;

    if (!(SUPPORTED_DOCUMENT_MIME_TYPES as readonly string[]).includes(selectedFile.type)) {
      toast.error("Alleen PDF, Word (.docx), PowerPoint (.pptx) en tekstbestanden worden ondersteund.");
      return;
    }

    if (selectedFile.size > DOCUMENT_MAX_FILE_SIZE_BYTES) {
      toast.error(
        `Bestand is te groot (max ${Math.round(DOCUMENT_MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB). ` +
          "Verklein het bestand of vul de activiteit handmatig in.",
      );
      return;
    }

    const form = event.currentTarget;
    setPhase("uploading");

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

      const storagePath = `${user.id}/${crypto.randomUUID()}-${sanitizeFileName(selectedFile.name)}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, selectedFile, { contentType: selectedFile.type, upsert: false });

      if (uploadError) {
        console.error("ActivityImportUploadCard: upload naar Storage mislukt:", uploadError.message);
        toast.error(
          "Bestand kon niet worden geüpload, controleer je verbinding of probeer een kleiner bestand.",
        );
        setPhase("idle");
        return;
      }

      const jobResult = await createActivityImportJob({
        storagePath,
        originalFilename: selectedFile.name,
        mimeType: selectedFile.type,
      });

      if ("error" in jobResult) {
        toast.error(jobResult.error);
        await supabase.storage.from(BUCKET).remove([storagePath]);
        setPhase("idle");
        return;
      }

      setPhase("processing");
      setStatusLabel(PROCESSING_LABELS.uploaded);
      setSelectedFile(null);
      form.reset();

      processActivityImportJob(jobResult.jobId).catch((cause) => {
        console.error("ActivityImportUploadCard: verwerking starten mislukt:", cause);
      });

      await pollJobStatus(jobResult.jobId);
    } catch (cause) {
      console.error("ActivityImportUploadCard: onverwachte fout:", cause);
      const detail = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
      toast.error(`Uploaden is mislukt. (${detail})`);
    } finally {
      if (!cancelledRef.current) {
        setPhase("idle");
      }
    }
  }

  const isBusy = phase !== "idle";

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileUp className="size-4 text-primary" aria-hidden="true" />
          <CardTitle className="text-base">Upload een bestaande activiteit</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <input
            type="file"
            accept={ACCEPT}
            onChange={handleFileChange}
            disabled={isBusy}
            className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <Button type="submit" variant="outline" disabled={!selectedFile || isBusy}>
            {phase === "uploading" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Bestand wordt geüpload...
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
      </CardContent>
    </Card>
  );
}
