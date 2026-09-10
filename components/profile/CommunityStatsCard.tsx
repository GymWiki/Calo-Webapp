import { Share2, Star } from "lucide-react";

import { StatCard } from "@/components/stat-card";
import type { CommunityStats } from "@/lib/services/community-stats";

/**
 * Bewust licht: alleen twee tellingen, geen badges/gamification (die zijn
 * eerder deze sessie al uit de refactor gehaald). "Keer opgeslagen door
 * anderen" is de hergebruik-proxy — er bestaat geen "bekeken"-teller.
 */
export function CommunityStatsCard({ stats }: { stats: CommunityStats }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <StatCard
        icon={Share2}
        label="Gedeelde activiteiten"
        value={stats.sharedActivitiesCount}
        accent="blue"
      />
      <StatCard
        icon={Star}
        label="Keer opgeslagen door anderen"
        value={stats.reuseCount}
        accent="yellow"
      />
    </div>
  );
}
