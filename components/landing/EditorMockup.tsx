import { Box, Download, RotateCw, Share2 } from "lucide-react";

import { IsoScene, type IsoBlock, type IsoCone } from "@/components/landing/IsoScene";
import { PauseOffscreen } from "@/components/landing/PauseOffscreen";

// Hero-animatie: een vensterschets van de editor waarin de opstelling zich stap voor stap opbouwt. Gekozen voor puur SVG + CSS-keyframes
// (transform/opacity, ~3 kB, geen JS-frameloop, geen WebGL, geen video): de lichtste optie die nog "levend" voelt, zonder LCP of TBT te raken.
const BLOCKS: IsoBlock[] = [
  { x: 1.5, y: 1.5, w: 3, d: 2, h: 0.35, color: "#7c5cff", delay: 0.4 },
  { x: 6.5, y: 1.2, w: 3.2, d: 1.2, h: 0.5, color: "#16a34a", delay: 1.6 },
  { x: 1.8, y: 5, w: 1.8, d: 1.8, h: 1.1, color: "#f59e0b", delay: 2.8 },
  { x: 5.5, y: 4.6, w: 3, d: 1, h: 0.4, color: "#2454ff", delay: 4 },
  { x: 9, y: 4.8, w: 1.6, d: 1.6, h: 0.9, color: "#ef4444", delay: 5.2 },
];
const CONES: IsoCone[] = [
  { x: 0.9, y: 0.9, delay: 6 },
  { x: 11, y: 0.9, delay: 6.3 },
  { x: 11, y: 7, delay: 6.6 },
  { x: 0.9, y: 7, delay: 6.9 },
];

export function EditorMockup() {
  return (
    <PauseOffscreen className="w-full">
      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-card shadow-brand-lg dark:border-paper/10" role="img" aria-label="Schets van de gratis 3D-plattegrondeditor met matten, banken en pionnen die in de zaal worden gezet">
        <div className="flex items-center gap-2 border-b bg-muted/60 px-3 py-2">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-red-400" />
            <span className="size-2.5 rounded-full bg-amber-400" />
            <span className="size-2.5 rounded-full bg-green-400" />
          </span>
          <span className="mx-auto truncate text-xs font-medium text-muted-foreground">Mijn gymzaal · GymWiki</span>
          <span className="flex gap-2 text-muted-foreground" aria-hidden="true">
            <Share2 className="size-3.5" />
            <Download className="size-3.5" />
          </span>
        </div>
        <div className="relative bg-gradient-to-b from-orange-50 to-amber-100 dark:from-zinc-900 dark:to-zinc-800">
          <div className="iso-float">
            <IsoScene blocks={BLOCKS} cones={CONES} animated className="mx-auto block h-auto w-full max-w-[520px]" />
          </div>
          <div className="absolute top-3 left-3 hidden flex-col gap-1.5 sm:flex" aria-hidden="true">
            {[Box, RotateCw].map((Icon, index) => (
              <span key={index} className="flex size-8 items-center justify-center rounded-lg border bg-card/90 text-muted-foreground shadow-sm">
                <Icon className="size-4" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </PauseOffscreen>
  );
}
