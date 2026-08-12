"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { PaywallModal } from "@/components/PaywallModal";
import { Button } from "@/components/ui/button";
import type { Activity } from "@/types/activity";
import { ActivityPdfDocument } from "./activity-pdf-document";

const DIACRITICS_PATTERN = /[̀-ͯ]/g;
const PAYWALL_MESSAGE =
  "A4 PDF export is een Pro-feature. Upgrade naar Pro of stijg naar Level 3 om korting te ontgrendelen!";

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
  isPro,
  xp,
  className,
}: {
  activity: Activity;
  isPro: boolean;
  xp: number;
  className?: string;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  async function handleDownload() {
    if (!isPro) {
      setPaywallOpen(true);
      return;
    }

    setIsGenerating(true);

    try {
      const blob = await pdf(<ActivityPdfDocument activity={activity} />).toBlob();
      const fileName = `Activiteit_${slugify(activity.titel, "activiteit")}.pdf`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("PDF genereren is mislukt. Probeer het opnieuw.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleDownload}
        disabled={isGenerating}
        className={className}
      >
        <Download className="size-4" />
        {isGenerating ? "PDF genereren..." : "PDF"}
      </Button>
      <PaywallModal
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        message={PAYWALL_MESSAGE}
        xp={xp}
      />
    </>
  );
}
