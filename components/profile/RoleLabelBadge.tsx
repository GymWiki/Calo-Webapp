"use client";

import { useRef, useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { updateRoleLabel } from "@/actions/profile";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ROLE_LABEL_MAX_LENGTH } from "@/lib/constants/profile";
import { useOptimisticAction } from "@/lib/hooks/useOptimisticAction";

/**
 * Vrij invulbare rol/functie naast de naam op het profiel — vervangt de
 * vaste "Niet beschikbaar voor stage"-badge (zie ProfileHeader.tsx).
 * Bewerkbaar via het potlood-icoon (of direct klikken op de badge zelf);
 * leeg = geen badge, alleen een subtiele "toevoegen"-knop.
 */
export function RoleLabelBadge({ initialValue }: { initialValue: string | null }) {
  const { value, run: save, isPending } = useOptimisticAction(initialValue, updateRoleLabel);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(initialValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEditing() {
    setDraft(value ?? "");
    setIsEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  function commit() {
    const trimmed = draft.trim();
    if (trimmed.length > ROLE_LABEL_MAX_LENGTH) {
      toast.error(`Rol/functie mag maximaal ${ROLE_LABEL_MAX_LENGTH} tekens zijn.`);
      return;
    }
    setIsEditing(false);
    save(trimmed || null);
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") cancelEditing();
          }}
          maxLength={ROLE_LABEL_MAX_LENGTH}
          placeholder="Bijv. Student CALO Zwolle, of Docent bewegingsonderwijs bij [schoolnaam]"
          className="h-8 w-64 max-w-full text-sm"
          disabled={isPending}
        />
        <button
          type="button"
          onClick={commit}
          disabled={isPending}
          aria-label="Opslaan"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-success hover:bg-success/10"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={cancelEditing}
          disabled={isPending}
          aria-label="Annuleren"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  if (!value) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Plus className="size-3" />
        Rol/functie toevoegen
      </button>
    );
  }

  return (
    <button type="button" onClick={startEditing} className="group inline-flex items-center gap-1">
      <Badge variant="secondary">{value}</Badge>
      <Pencil className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
