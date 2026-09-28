"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Merge, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { createTeamTag, deleteTeamTag, mergeTeamTags, renameTeamTag } from "@/actions/teamLibrary";
import { tagColorClass } from "@/components/team/TagEditor";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TeamTag } from "@/types/teamLibrary";

const SUGGESTIONS = ["1e klas", "3 vwo", "toets", "warming-up"];

function TagRow({
  tag,
  isOwner,
  mergeMode,
  selected,
  onToggleSelected,
}: {
  tag: TeamTag;
  isOwner: boolean;
  mergeMode: boolean;
  selected: boolean;
  onToggleSelected: () => void;
}) {
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(tag.name);
  const [isPending, startTransition] = useTransition();

  function handleRename() {
    if (name.trim() === tag.name) {
      setIsRenaming(false);
      return;
    }
    startTransition(async () => {
      const result = await renameTeamTag(tag.id, name);
      if ("error" in result) {
        toast.error(result.error);
        setName(tag.name);
        return;
      }
      toast.success("Tag hernoemd.");
      setIsRenaming(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (
      !window.confirm(
        `Tag "${tag.name}" verwijderen? Deze hangt aan ${tag.itemCount ?? 0} ${tag.itemCount === 1 ? "activiteit" : "activiteiten"} — de tag wordt daar overal weggehaald.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteTeamTag(tag.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Tag verwijderd.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      {mergeMode && (
        <button
          type="button"
          onClick={onToggleSelected}
          aria-pressed={selected}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
          )}
        >
          {selected && <Check className="size-3" />}
        </button>
      )}

      {isRenaming ? (
        <div className="flex flex-1 items-center gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleRename()}
            autoFocus
            maxLength={30}
          />
          <Button type="button" size="sm" disabled={isPending} onClick={handleRename}>
            Opslaan
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setName(tag.name);
              setIsRenaming(false);
            }}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <>
          <span className={cn("rounded-full border px-2.5 py-1 text-sm font-medium", tagColorClass(tag.color))}>
            {tag.name}
          </span>
          <span className="flex-1 text-sm text-muted-foreground">
            {tag.itemCount ?? 0} {tag.itemCount === 1 ? "activiteit" : "activiteiten"}
          </span>
          {isOwner && !mergeMode && (
            <div className="flex gap-1.5">
              <Button type="button" size="icon" variant="outline" onClick={() => setIsRenaming(true)} aria-label="Hernoemen">
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={isPending}
                onClick={handleDelete}
                className="text-destructive hover:text-destructive"
                aria-label="Verwijderen"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function TagsManager({ tags, isOwner }: { tags: TeamTag[]; isOwner: boolean }) {
  const router = useRouter();
  const [newTagName, setNewTagName] = useState("");
  const [isCreating, startCreateTransition] = useTransition();
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMerging, startMergeTransition] = useTransition();

  function toggleSelected(tagId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function handleCreate(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    startCreateTransition(async () => {
      const result = await createTeamTag(trimmed, null);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Tag "${trimmed}" aangemaakt.`);
      setNewTagName("");
      router.refresh();
    });
  }

  function handleMerge(targetId: string) {
    const sourceIds = [...selectedIds].filter((id) => id !== targetId);
    if (sourceIds.length === 0) return;
    startMergeTransition(async () => {
      for (const sourceId of sourceIds) {
        const result = await mergeTeamTags(sourceId, targetId);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
      }
      toast.success("Tags samengevoegd.");
      setMergeMode(false);
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <Input
          value={newTagName}
          onChange={(event) => setNewTagName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && handleCreate(newTagName)}
          placeholder="Nieuwe tag, bijv. '3 vwo'"
          maxLength={30}
        />
        <Button type="button" disabled={isCreating || !newTagName.trim()} onClick={() => handleCreate(newTagName)}>
          <Plus className="size-4" />
          Toevoegen
        </Button>
      </div>

      {tags.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Nog geen tags"
          description="Tags helpen het team activiteiten terugvinden, bijv. per klas of lesdoel. Probeer een van deze:"
          action={
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <Button key={suggestion} type="button" variant="outline" size="sm" onClick={() => handleCreate(suggestion)}>
                  + {suggestion}
                </Button>
              ))}
            </div>
          }
        />
      ) : (
        <>
          {isOwner && (
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{tags.length} tags</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setMergeMode((prev) => !prev);
                  setSelectedIds(new Set());
                }}
              >
                <Merge className="size-4" />
                {mergeMode ? "Annuleren" : "Samenvoegen"}
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {tags.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                isOwner={isOwner}
                mergeMode={mergeMode}
                selected={selectedIds.has(tag.id)}
                onToggleSelected={() => toggleSelected(tag.id)}
              />
            ))}
          </div>

          {mergeMode && selectedIds.size >= 2 && (
            <div className="rounded-lg border bg-card p-3">
              <p className="mb-2 text-sm font-medium">Samenvoegen naar welke tag?</p>
              <div className="flex flex-wrap gap-1.5">
                {tags
                  .filter((tag) => selectedIds.has(tag.id))
                  .map((tag) => (
                    <Button
                      key={tag.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isMerging}
                      onClick={() => handleMerge(tag.id)}
                    >
                      {tag.name}
                    </Button>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
