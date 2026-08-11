import type { DidacticCategory } from "@/types/lesson";

// Shared between the client-side add-to-list editor and the server-rendered
// detail-page matrix — kept in a plain (non "use client") module since a
// Server Component importing a data-only export from a "use client" file
// isn't reliable under Turbopack.
export const CATEGORY_STYLES: Record<
  DidacticCategory,
  { emoji: string; border: string; header: string }
> = {
  loopt_het: {
    emoji: "🟢",
    border: "border-success/30",
    header: "bg-success/10 text-success",
  },
  lukt_het: {
    emoji: "🟡",
    border: "border-court-yellow/40",
    header: "bg-court-yellow/15 text-court-yellow",
  },
  leeft_het: {
    emoji: "🔵",
    border: "border-line-blue/30",
    header: "bg-line-blue/10 text-line-blue",
  },
};
