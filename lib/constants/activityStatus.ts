import { CircleCheck, Clock, FileEdit, TriangleAlert, type LucideIcon } from "lucide-react";

import type { ActivityReviewStatus } from "@/types/activity";

// Gedeelde status→stijl-koppeling voor elke plek die een activiteit-status
// toont (dashboard-overzicht, "Mijn activiteiten", "Concepten") — één plek
// zodat label/kleur/icoon overal hetzelfde blijven.
export const ACTIVITY_STATUS_STYLES: Record<
  ActivityReviewStatus,
  { label: string; variant: "success" | "destructive" | "secondary" | "outline"; icon: LucideIcon }
> = {
  draft: { label: "Concept", variant: "outline", icon: FileEdit },
  pending: { label: "Wordt gecontroleerd", variant: "secondary", icon: Clock },
  approved: { label: "Goedgekeurd", variant: "success", icon: CircleCheck },
  rejected: { label: "Niet goedgekeurd", variant: "destructive", icon: TriangleAlert },
};
