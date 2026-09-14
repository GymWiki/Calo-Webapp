import type { DidacticCategory } from "@/types/lesson";

// Eén kleurbron voor "Loopt het?"/"Lukt het?"/"Leeft het?" — gebruikt door de
// eenvoudige-activiteit-weergave (loopt/lukt/leeft-arrays), de wizard-weergave
// (DidacticsMatrix, via styleOverrides) én de wizard-editor (DidacticsForm),
// zodat alle drie exact dezelfde blauw/groen/rood-identiteit tonen ongeacht
// welke van de twee activiteit-varianten of welke modus (bekijken/bewerken)
// het is. Geen emoji — de eenvoudige weergave gebruikt die ook niet.
export const LEERHULP_COLORS = {
  loopt: { border: "border-blue-200", header: "bg-blue-50 text-blue-900", emoji: "" },
  lukt: { border: "border-green-200", header: "bg-green-50 text-green-900", emoji: "" },
  leeft: { border: "border-red-200", header: "bg-red-50 text-red-900", emoji: "" },
} as const;

// Dezelfde kleuren, maar geadresseerd op de DidacticCategory-sleutels
// (loopt_het/lukt_het/leeft_het) — voor DidacticsMatrix/DidacticsForm's
// `styleOverrides`-prop.
export const LEERHULP_DIDACTIC_STYLE_OVERRIDES: Record<
  DidacticCategory,
  { border: string; header: string; emoji: string }
> = {
  loopt_het: LEERHULP_COLORS.loopt,
  lukt_het: LEERHULP_COLORS.lukt,
  leeft_het: LEERHULP_COLORS.leeft,
};
