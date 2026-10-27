import { Activity, CircleDot, Cone, Dumbbell, Goal, Layers, Package, Trophy, Users, type LucideIcon } from "lucide-react";

import type { LibraryIconName } from "@/lib/constants/libraryTaxonomy";

// Vertaalt de icoonnaam uit de taxonomie-config naar het lucide-icoon.
export const LIBRARY_ICONS: Record<LibraryIconName, LucideIcon> = {
  Activity,
  CircleDot,
  Cone,
  Dumbbell,
  Goal,
  Layers,
  Package,
  Trophy,
  Users,
};
