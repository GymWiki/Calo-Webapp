"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Check, Copy, Globe, Share2 } from "lucide-react";
import { toast } from "sonner";

import { setLessonPublic } from "@/actions/lesson";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// navigator.share support never changes mid-session, but is only knowable
// client-side — useSyncExternalStore (server snapshot false, no-op
// subscribe) resyncs it right after hydration without a mismatch flash.
function subscribeNever() {
  return () => {};
}
function getCanShareSnapshot() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}
function getCanShareServerSnapshot() {
  return false;
}
function useCanNativeShare() {
  return useSyncExternalStore(
    subscribeNever,
    getCanShareSnapshot,
    getCanShareServerSnapshot,
  );
}

export function ShareLessonButton({
  lessonId,
  lessonTitle,
  isOwner,
  initialIsPublic,
  className,
}: {
  lessonId: string;
  lessonTitle: string;
  isOwner: boolean;
  initialIsPublic: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canNativeShare = useCanNativeShare();

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/les/share/${lessonId}`
      : `/les/share/${lessonId}`;

  async function handlePrimaryShareAction() {
    if (canNativeShare) {
      try {
        await navigator.share({
          title: lessonTitle,
          text: `Bekijk deze lesvoorbereiding op GymBase: ${lessonTitle}`,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled the native share sheet — no error toast needed.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link gekopieerd naar klembord.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopiëren is mislukt. Probeer het opnieuw.");
    }
  }

  function handleTogglePublic(next: boolean) {
    setIsPublic(next);
    startTransition(async () => {
      const result = await setLessonPublic(lessonId, next);
      if ("error" in result) {
        setIsPublic(!next);
        toast.error(result.error);
        return;
      }
      toast.success(
        next ? "Les is nu openbaar in de bibliotheek." : "Les is weer privé.",
      );
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={className}
        onClick={() => setOpen(true)}
      >
        <Share2 className="size-4" />
        Delen
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Les delen</DialogTitle>
            <DialogDescription>
              Deel &quot;{lessonTitle}&quot; via een unieke link, of maak
              &apos;m openbaar in de bibliotheek.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="rounded-md border bg-muted px-3 py-2 text-sm break-all text-muted-foreground">
                {shareUrl}
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={handlePrimaryShareAction}
              >
                {canNativeShare ? (
                  <>
                    <Share2 className="size-4" />
                    Deel unieke link
                  </>
                ) : copied ? (
                  <>
                    <Check className="size-4" />
                    Gekopieerd
                  </>
                ) : (
                  <>
                    <Copy className="size-4" />
                    Kopieer unieke link
                  </>
                )}
              </Button>
            </div>

            {isOwner && (
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <Globe className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <Label htmlFor="lesson-public-toggle">
                      Openbaar in bibliotheek
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Andere docenten en studenten kunnen deze les vinden en
                      kopiëren.
                    </p>
                  </div>
                </div>
                <Switch
                  id="lesson-public-toggle"
                  checked={isPublic}
                  onCheckedChange={handleTogglePublic}
                  disabled={isPending}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
