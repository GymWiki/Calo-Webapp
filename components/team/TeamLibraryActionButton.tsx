"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Users2 } from "lucide-react";
import { toast } from "sonner";

import { addReferenceToTeamLibrary, copyToTeamLibrary } from "@/actions/teamLibrary";
import { TagEditor } from "@/components/team/TagEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TeamLibraryItem, TeamTag } from "@/types/teamLibrary";

/**
 * "Team"-actie in de bestaande actieset (ActivityDetailActions/
 * ActivityWizardPage) — één knop die, gebundeld in een dialoog i.p.v. de
 * balk te overladen, ofwel "toevoegen als referentie"/"kopiëren om aan te
 * passen" aanbiedt (nog niet in de teambibliotheek), ofwel meteen de
 * tag-editor toont (al toegevoegd — "In teambibliotheek ✓").
 */
export function TeamLibraryActionButton({
  activityId,
  activityTitle,
  existingItem,
  allTeamTags,
  variant = "sidebar",
  className,
}: {
  activityId: string;
  activityTitle: string;
  existingItem: TeamLibraryItem | null;
  allTeamTags: TeamTag[];
  variant?: "sidebar" | "icons";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleAddReference() {
    startTransition(async () => {
      const result = await addReferenceToTeamLibrary(activityId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Toegevoegd aan de teambibliotheek.");
      setOpen(false);
      router.refresh();
    });
  }

  function handleCopy() {
    startTransition(async () => {
      const result = await copyToTeamLibrary(activityId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Gekopieerd naar de teambibliotheek.");
      setOpen(false);
      router.push(`/les-maken?vanuit=${result.newActivityId}`);
    });
  }

  const label = existingItem ? "In teambibliotheek" : "Team";
  const Icon = existingItem ? Check : Users2;

  return (
    <>
      {variant === "icons" ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label={label}
          title={label}
          className={className}
        >
          <Icon className={existingItem ? "size-4 text-primary" : "size-4"} />
        </Button>
      ) : (
        <Button type="button" variant="outline" className={className} onClick={() => setOpen(true)}>
          <Icon className={existingItem ? "size-4 text-primary" : "size-4"} />
          {label}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{existingItem ? "In teambibliotheek" : "Toevoegen aan teambibliotheek"}</DialogTitle>
            {!existingItem && (
              <DialogDescription>
                Kies hoe &quot;{activityTitle}&quot; in de teambibliotheek terechtkomt.
              </DialogDescription>
            )}
          </DialogHeader>

          {existingItem ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {existingItem.kind === "reference"
                  ? "Toegevoegd als referentie — het origineel blijft ongewijzigd en actueel."
                  : "Dit is een teamkopie, vrij te bewerken door het hele team."}
              </p>
              <div>
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tags</p>
                <TagEditor itemId={existingItem.id} initialTags={existingItem.tags} allTeamTags={allTeamTags} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={isPending}
                  onClick={handleAddReference}
                >
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  Toevoegen aan teambibliotheek
                </Button>
                <p className="px-1 text-xs text-muted-foreground">Het origineel blijft ongewijzigd en actueel.</p>
              </div>
              <div className="space-y-1">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={isPending}
                  onClick={handleCopy}
                >
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  Kopiëren om aan te passen
                </Button>
                <p className="px-1 text-xs text-muted-foreground">
                  Maakt een eigen, vrij bewerkbare teamkopie met bronvermelding.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
