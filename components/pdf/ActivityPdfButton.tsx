"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getArrangementImage, loadArrangementImageDataUrl } from "@/lib/pdf/arrangementImage";
import type { Activity } from "@/types/activity";

const DIACRITICS_PATTERN = /[̀-ͯ]/g;

function slugify(value: string, fallback: string) {
  const slug = value
    .normalize("NFKD")
    .replace(DIACRITICS_PATTERN, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || fallback;
}

export function ActivityPdfButton({
  activity,
  className,
  size,
}: {
  activity: Activity;
  className?: string;
  size?: "default" | "sm";
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleDownload() {
    setIsGenerating(true);

    try {
      // @react-pdf/renderer (2,8MB) en het Document-component pas laden op
      // het moment van klikken i.p.v. statisch bovenaan het bestand — dit
      // component staat op de activiteit-detailpagina/wizard, die vrijwel
      // iedereen bezoekt terwijl maar een klein deel ooit op "PDF" klikt
      // (zie de performance-audit: dit was de zwaarste onnodig-globale
      // client-bundle in de app).
      const [{ pdf }, { ActivityPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./activity-pdf-document"),
      ]);

      // Vooraf ophalen als data-URL i.p.v. een URL aan <Image> meegeven —
      // zie lib/pdf/arrangementImage.ts: zo faalt een niet-op-te-halen
      // afbeelding (CORS, verlopen URL, niet-toegestane host) niet de hele
      // export, alleen deze ene afbeelding blijft dan weg.
      const arrangementUrl = getArrangementImage(activity);
      const imageDataUrl = arrangementUrl
        ? await loadArrangementImageDataUrl(arrangementUrl)
        : null;

      const blob = await pdf(
        <ActivityPdfDocument activity={activity} imageDataUrl={imageDataUrl} />,
      ).toBlob();
      const fileName = `Activiteit_${slugify(activity.titel, "activiteit")}.pdf`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("ActivityPdfButton: PDF genereren mislukt —", err);
      toast.error("PDF genereren is mislukt. Probeer het opnieuw.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={handleDownload}
      disabled={isGenerating}
      className={className}
    >
      <Download className="size-4" />
      {isGenerating ? "PDF genereren..." : "PDF"}
    </Button>
  );
}
