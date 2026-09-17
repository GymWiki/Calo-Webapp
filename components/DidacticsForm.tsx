"use client";

import { DidacticsAddToList } from "@/components/DidacticsAddToList";
import type { DidacticSuggestion } from "@/types/ai";
import { DIDACTIC_CATEGORIES, type DidacticCategory, type DidacticItem } from "@/types/lesson";

export function DidacticsForm({
  items,
  onChange,
  styleOverrides,
  suggestions,
  onApplySuggestion,
  onDismissSuggestion,
}: {
  items: DidacticItem[];
  onChange: (items: DidacticItem[]) => void;
  /** Zie DidacticsMatrix/DidacticsAddToList — laat een pagina de
   * kleuren/emoji per L overschrijven (bijv. dezelfde blauw/groen/rood-
   * identiteit als de eenvoudige-activiteit-Leerhulp-kaarten). */
  styleOverrides?: Partial<Record<DidacticCategory, { border: string; header: string; emoji?: string }>>;
  /** AI Lescoach: alle Leerhulp-variant-suggesties, ongefilterd — hier per
   * categorie uitgesplitst voor DidacticsAddToList. */
  suggestions?: DidacticSuggestion[];
  onApplySuggestion?: (suggestion: DidacticSuggestion) => void;
  onDismissSuggestion?: (id: string) => void;
}) {
  function handleAdd(item: DidacticItem) {
    onChange([...items, item]);
  }

  function handleUpdate(updated: DidacticItem) {
    onChange(items.map((item) => (item.id === updated.id ? updated : item)));
  }

  function handleRemove(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-4">
      {DIDACTIC_CATEGORIES.map((category) => (
        <DidacticsAddToList
          key={category}
          category={category}
          items={items.filter((item) => item.category === category)}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
          styleOverride={styleOverrides?.[category]}
          suggestions={suggestions?.filter((suggestion) => suggestion.category === category)}
          onApplySuggestion={onApplySuggestion}
          onDismissSuggestion={onDismissSuggestion}
        />
      ))}
    </div>
  );
}
