"use client";

import { DidacticsAddToList } from "@/components/DidacticsAddToList";
import { DIDACTIC_CATEGORIES, type DidacticItem } from "@/types/lesson";

export function DidacticsForm({
  items,
  onChange,
}: {
  items: DidacticItem[];
  onChange: (items: DidacticItem[]) => void;
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
        />
      ))}
    </div>
  );
}
