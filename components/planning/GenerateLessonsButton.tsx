"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { generateUpcomingLessons } from "@/actions/planning";
import { Button } from "@/components/ui/button";

export function GenerateLessonsButton({ classId }: { classId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await generateUpcomingLessons(classId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Weekplanning aangevuld met de komende 12 weken.");
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick} disabled={isPending}>
      <RefreshCw className="size-4" />
      {isPending ? "Bezig…" : "Genereer volgende 12 weken"}
    </Button>
  );
}
