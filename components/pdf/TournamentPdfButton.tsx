"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { TournamentSchedule, TournamentScores } from "@/types/tournament";

const DIACRITICS_PATTERN = /[̀-ͯ]/g;

function slugify(value: string, fallback: string) {
  const slug = value
    .normalize("NFKD")
    .replace(DIACRITICS_PATTERN, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || fallback;
}

export function TournamentPdfButton({
  schedule,
  scores,
  title,
  className,
}: {
  schedule: TournamentSchedule;
  scores: TournamentScores;
  title: string;
  className?: string;
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleDownload() {
    setIsGenerating(true);

    try {
      // Zie ActivityPdfButton.tsx — pas bij klikken laden i.p.v. statisch.
      const [{ pdf }, { TournamentPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./tournament-pdf-document"),
      ]);
      const blob = await pdf(
        <TournamentPdfDocument schedule={schedule} scores={scores} title={title} />,
      ).toBlob();
      const fileName = `Toernooischema_${slugify(title, "toernooi")}.pdf`;

      // Web: download; native app: deelmenu.
      const { saveOrShareFile } = await import("@/lib/mobile/shareFile");
      await saveOrShareFile(blob, fileName);
    } catch {
      toast.error("PDF genereren is mislukt. Probeer het opnieuw.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleDownload}
      disabled={isGenerating}
      className={className}
    >
      <Download className="size-4" />
      {isGenerating ? "PDF genereren..." : "Exporteer als PDF"}
    </Button>
  );
}
