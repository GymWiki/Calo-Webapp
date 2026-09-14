"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// Zelfde amber-markering als de "kon niet automatisch worden ingevuld"-hint
// bij een geïmporteerde activiteit (zie IMPORT_FLAG_CLASS in lesson-form.tsx)
// — hier lokaal gehouden zodat dit component geen afhankelijkheid krijgt op
// een private const uit een ander bestand.
const FLAG_CLASS = "border-amber-400 ring-1 ring-amber-300/70 focus-visible:ring-amber-400";

/**
 * Notion-stijl klik-om-te-bewerken tekstveld: toont de opgemaakte leeswaarde
 * (of een grijze, cursieve placeholder-prompt wanneer leeg) totdat erop
 * geklikt of getabt wordt, wisselt dan naar een meegroeiende textarea, en
 * slaat op zodra het veld het focus verliest (`onCommit`, gebruikt voor de
 * concept-auto-save).
 */
export function InlineEditText({
  value,
  onChange,
  onCommit,
  placeholder,
  required,
  flagged,
  className,
  textClassName,
  minRows = 2,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit?: () => void;
  placeholder: string;
  required?: boolean;
  flagged?: boolean;
  className?: string;
  textClassName?: string;
  minRows?: number;
}) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isEmpty = value.trim().length === 0;

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!editing || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing, value]);

  function handleBlur() {
    setEditing(false);
    onCommit?.();
  }

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        rows={minRows}
        className={cn(
          "w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          flagged && isEmpty && FLAG_CLASS,
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={isEmpty ? `${placeholder} — klik om in te vullen` : "Klik om te bewerken"}
      className={cn(
        "block w-full rounded-md border border-transparent px-3 py-2 text-left text-sm transition-colors hover:border-input hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        flagged && isEmpty && FLAG_CLASS,
        className,
      )}
    >
      <span
        className={cn(
          "whitespace-pre-line",
          isEmpty ? "text-muted-foreground italic" : "text-foreground",
          textClassName,
        )}
      >
        {isEmpty ? placeholder : value}
      </span>
      {required && isEmpty && (
        <span className="ml-2 align-middle text-xs font-medium text-amber-600 not-italic">
          Verplicht
        </span>
      )}
    </button>
  );
}
