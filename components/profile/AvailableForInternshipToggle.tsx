"use client";

import { toast } from "sonner";

import { updateAvailableForInternship } from "@/actions/profile";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useOptimisticAction } from "@/lib/hooks/useOptimisticAction";

export function AvailableForInternshipToggle({
  initialValue,
}: {
  initialValue: boolean;
}) {
  const {
    value,
    run: handleChange,
    isPending,
  } = useOptimisticAction(initialValue, updateAvailableForInternship, {
    onSuccess: (_result, next) => {
      toast.success(
        next
          ? "Je staat nu als beschikbaar voor stage."
          : "Je staat nu als niet beschikbaar voor stage.",
      );
    },
  });

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div>
        <Label htmlFor="internship-toggle">Beschikbaar voor stage</Label>
        <p className="text-xs text-muted-foreground">
          Zichtbaar voor scholen/begeleiders die op zoek zijn naar stagiairs.
        </p>
      </div>
      <Switch
        id="internship-toggle"
        checked={value}
        onCheckedChange={handleChange}
        disabled={isPending}
      />
    </div>
  );
}
