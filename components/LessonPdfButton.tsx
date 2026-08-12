"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { PaywallModal } from "@/components/PaywallModal";
import { Button } from "@/components/ui/button";
import type { LessonWithDetails } from "@/types/lesson";
import { LessonPdfDocument } from "./lesson-pdf-document";

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

export function LessonPdfButton({
  lesson,
  isPro,
  xp,
  className,
}: {
  lesson: LessonWithDetails;
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
      const blob = await pdf(<LessonPdfDocument lesson={lesson} />).toBlob();
      const fileName = `Lesvoorbereiding_${slugify(lesson.title, "les")}_${slugify(
        lesson.group_name ?? "",
        "groep",
      )}.pdf`;

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
        onClick={handleDownload}
        disabled={isGenerating}
        className={className}
      >
        <Download className="size-4" />
        {isGenerating ? "PDF genereren..." : "Download als PDF"}
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
