"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Activity } from "@/types/activity";
import type { DidacticItem, LessonBlock, LessonWithDetails } from "@/types/lesson";
import { LessonPdfDocument } from "./lesson-pdf-document";

const DIACRITICS_PATTERN = /[̀-ͯ]/g;

function slugify(value: string, fallback: string) {
  const slug = value
    .normalize("NFKD")
    .replace(DIACRITICS_PATTERN, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || fallback;
}

// LessonPdfDocument's props still use the pre-consolidatie "Lesson"-vorm
// (zie types/lesson.ts) — dat interne renderer-detail hoefde niet mee te
// veranderen, dus dit bouwt dat exacte shape hier op vanuit de unified
// Activity-rij i.p.v. het PDF-document zelf te herschrijven.
function toLessonPdfShape(activity: Activity, authorName: string | null): LessonWithDetails {
  const blocks: LessonBlock[] = [
    { id: "arrangement", lesson_id: activity.id, block_type: "arrangement", content: activity.arrangement ?? "", created_at: "" },
    { id: "deelnemers_regels", lesson_id: activity.id, block_type: "deelnemers_regels", content: activity.deelnemers_regels ?? "", created_at: "" },
    { id: "plaatje_praatje", lesson_id: activity.id, block_type: "plaatje_praatje", content: activity.plaatje_praatje ?? "", created_at: "" },
    { id: "aandachtspunten", lesson_id: activity.id, block_type: "aandachtspunten", content: activity.aandachtspunten ?? "", created_at: "" },
  ];

  return {
    id: activity.id,
    author_id: activity.author_id ?? "",
    title: activity.titel,
    description: null,
    is_public: activity.is_public,
    lesson_date: activity.activity_date,
    group_name: activity.group_name,
    movement_problem: activity.movement_problem,
    movement_theme: activity.beweegthema,
    learning_line: activity.leerlijn,
    doelgroep: activity.doelgroep,
    goals: activity.doel,
    learning_outcomes: activity.learning_outcomes,
    points_of_attention: null,
    rules: activity.regels,
    min_participants: activity.min_participants,
    participants_bench: activity.participants_bench,
    base_materials: activity.base_materials,
    rule_materials: activity.rule_materials,
    diagram_data: activity.diagram_data,
    diagram_image_url: activity.diagram_image_url,
    game_category: activity.game_category,
    game_dimensions: activity.game_dimensions,
    tactical_questions: activity.tactical_questions,
    is_ai_generated: activity.is_ai_generated,
    public_since: activity.public_since,
    created_at: activity.submitted_at,
    updated_at: activity.submitted_at,
    lesson_didactics: { id: activity.id, lesson_id: activity.id, items: (activity.didactic_items ?? []) as DidacticItem[] },
    lesson_blocks: blocks,
    author: authorName
      ? { first_name: authorName.split(" ")[0] ?? "", last_name: authorName.split(" ").slice(1).join(" ") }
      : null,
  };
}

export function LessonPdfButton({
  activity,
  authorName,
  className,
}: {
  activity: Activity;
  authorName: string | null;
  className?: string;
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleDownload() {
    setIsGenerating(true);

    try {
      const lesson = toLessonPdfShape(activity, authorName);
      const blob = await pdf(<LessonPdfDocument lesson={lesson} />).toBlob();
      const fileName = `Activiteit_${slugify(lesson.title, "activiteit")}_${slugify(
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
    <Button
      type="button"
      onClick={handleDownload}
      disabled={isGenerating}
      className={className}
    >
      <Download className="size-4" />
      {isGenerating ? "PDF genereren..." : "Download als PDF"}
    </Button>
  );
}
