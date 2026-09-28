"use client";

import { useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { assignTagToItem, createAndAssignTag, unassignTagFromItem } from "@/actions/teamLibrary";
import { cn } from "@/lib/utils";
import type { TeamTag } from "@/types/teamLibrary";

const TAG_COLOR_CLASS: Record<string, string> = {
  slate: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  red: "border-red-300 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  amber: "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  emerald: "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  sky: "border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
  violet: "border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  pink: "border-pink-300 bg-pink-100 text-pink-700 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-300",
};
const DEFAULT_TAG_COLOR_CLASS =
  "border-input bg-muted text-foreground";

export function tagColorClass(color: string | null): string {
  return (color && TAG_COLOR_CLASS[color]) || DEFAULT_TAG_COLOR_CLASS;
}

/**
 * Tag-toewijzing voor één teambibliotheek-item — typeahead op bestaande
 * team-tags + direct nieuwe aanmaken ("typ en Enter", zie de brief).
 * Optimistisch: de chip verschijnt/verdwijnt meteen, revert bij een fout.
 */
export function TagEditor({
  itemId,
  initialTags,
  allTeamTags,
  className,
}: {
  itemId: string;
  initialTags: TeamTag[];
  /** Alle tags van het team — voor de typeahead-suggesties. */
  allTeamTags: TeamTag[];
  className?: string;
}) {
  const [tags, setTags] = useState<TeamTag[]>(initialTags);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();

  const suggestions = useMemo(() => {
    const query = input.trim().toLowerCase();
    const assignedIds = new Set(tags.map((tag) => tag.id));
    return allTeamTags
      .filter((tag) => !assignedIds.has(tag.id))
      .filter((tag) => (query ? tag.name.toLowerCase().includes(query) : true))
      .slice(0, 6);
  }, [allTeamTags, tags, input]);

  function addExistingTag(tag: TeamTag) {
    setTags((prev) => [...prev, tag]);
    setInput("");
    startTransition(async () => {
      const result = await assignTagToItem(itemId, tag.id);
      if ("error" in result) {
        setTags((prev) => prev.filter((entry) => entry.id !== tag.id));
        toast.error(result.error);
      }
    });
  }

  function submitInput() {
    const trimmed = input.trim();
    if (!trimmed) return;

    const existing = allTeamTags.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      addExistingTag(existing);
      return;
    }

    const placeholderId = `pending-${trimmed}`;
    const placeholder: TeamTag = {
      id: placeholderId,
      teamId: "",
      name: trimmed,
      color: null,
      createdBy: null,
      createdAt: new Date().toISOString(),
    };
    setTags((prev) => [...prev, placeholder]);
    setInput("");
    startTransition(async () => {
      const result = await createAndAssignTag(itemId, trimmed);
      if ("error" in result) {
        setTags((prev) => prev.filter((entry) => entry.id !== placeholderId));
        toast.error(result.error);
        return;
      }
      setTags((prev) =>
        prev.map((entry) => (entry.id === placeholderId ? { ...entry, id: result.tagId } : entry)),
      );
    });
  }

  function removeTag(tag: TeamTag) {
    setTags((prev) => prev.filter((entry) => entry.id !== tag.id));
    startTransition(async () => {
      const result = await unassignTagFromItem(itemId, tag.id);
      if ("error" in result) {
        setTags((prev) => [...prev, tag]);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              tagColorClass(tag.color),
            )}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              disabled={isPending}
              aria-label={`Tag ${tag.name} verwijderen`}
              className="rounded-full hover:opacity-70"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <div className="relative">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitInput();
              }
            }}
            placeholder="+ tag"
            className="h-6 w-24 rounded-full border border-dashed border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50"
          />
          {input.trim() && suggestions.length > 0 && (
            <div className="absolute top-full left-0 z-10 mt-1 w-40 rounded-md border bg-popover p-1 shadow-md">
              {suggestions.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => addExistingTag(tag)}
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
