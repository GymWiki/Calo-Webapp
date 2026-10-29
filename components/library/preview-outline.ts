/**
 * Dunne donkere rand plus zachte schaduw rond het object in een materiaalpreview. De PNG's hebben een transparante achtergrond en
 * staan op een licht vlak (zie ModelItem); witte, gele en dunne objecten (ballen, netten, ladders, hockeybalken) vielen daar bijna
 * weg. De achtergrond blijft zoals hij was: alleen de rand van het object zelf wordt gemarkeerd (CSS `filter` volgt de alfakant).
 */
const EDGE = "rgb(51 65 85 / 0.55)";

export const PREVIEW_OUTLINE_FILTER = [
  `drop-shadow(0.75px 0 0 ${EDGE})`,
  `drop-shadow(-0.75px 0 0 ${EDGE})`,
  `drop-shadow(0 0.75px 0 ${EDGE})`,
  `drop-shadow(0 -0.75px 0 ${EDGE})`,
  "drop-shadow(0 1px 2px rgb(15 23 42 / 0.22))",
].join(" ");
