import { LEARNING_LINE_CATEGORIES } from "./learningLines";

// Central category → color mapping, shared by the merged bibliotheekpagina
// (list-tile left border), its filter chips, and both detail pages — one
// place to keep the categorie/kleur-koppeling consistent everywhere.
export type CategoryColorStyle = {
  border: string;
  text: string;
  dot: string;
};

export const CATEGORY_COLORS: Record<string, CategoryColorStyle> = {
  Atletiek: { border: "border-l-orange-500", text: "text-orange-600", dot: "bg-orange-500" },
  Spel: { border: "border-l-yellow-500", text: "text-yellow-600", dot: "bg-yellow-500" },
  "Bewegen op muziek": {
    border: "border-l-pink-500",
    text: "text-pink-600",
    dot: "bg-pink-500",
  },
  Klimmen: { border: "border-l-green-500", text: "text-green-600", dot: "bg-green-500" },
  Turnen: { border: "border-l-blue-500", text: "text-blue-600", dot: "bg-blue-500" },
  Zelfverdediging: { border: "border-l-red-500", text: "text-red-600", dot: "bg-red-500" },
  Zwemmen: { border: "border-l-cyan-500", text: "text-cyan-600", dot: "bg-cyan-500" },
  Overig: { border: "border-l-gray-400", text: "text-gray-600", dot: "bg-gray-400" },
};

// Dev-time guard: every category in the canonical taxonomy must have a
// color, so a newly added category can't silently fall back unstyled.
if (process.env.NODE_ENV !== "production") {
  const missing = LEARNING_LINE_CATEGORIES.map((c) => c.category).filter(
    (category) => !CATEGORY_COLORS[category],
  );
  if (missing.length > 0) {
    console.warn(`CATEGORY_COLORS mist kleuren voor: ${missing.join(", ")}`);
  }
}

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS.Overig;

export function getCategoryColor(category: string | null | undefined): CategoryColorStyle {
  if (!category) return DEFAULT_CATEGORY_COLOR;
  return CATEGORY_COLORS[category] ?? DEFAULT_CATEGORY_COLOR;
}
