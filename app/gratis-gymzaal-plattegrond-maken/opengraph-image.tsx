import { ImageResponse } from "next/og";

import { IsoScene, type IsoBlock } from "@/components/landing/IsoScene";

export const alt = "Gratis gymzaal plattegrond maken in 3D — GymWiki";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BLOCKS: IsoBlock[] = [
  { x: 1.5, y: 1.5, w: 3, d: 2, h: 0.35, color: "#7c5cff" },
  { x: 6.5, y: 1.2, w: 3.2, d: 1.2, h: 0.5, color: "#16a34a" },
  { x: 1.8, y: 5, w: 1.8, d: 1.8, h: 1.1, color: "#f59e0b" },
  { x: 5.5, y: 4.6, w: 3, d: 1, h: 0.4, color: "#2454ff" },
  { x: 9, y: 4.8, w: 1.6, d: 1.6, h: 0.9, color: "#ef4444" },
];

// 3D-voorbeeldplaatje voor Open Graph/Twitter: dezelfde isometrische schets als op de landingspagina.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", backgroundColor: "#f6f5f1", padding: "56px 64px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 540 }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#ff5a1f", letterSpacing: "0.12em" }}>GYMWIKI</div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 64, fontWeight: 800, lineHeight: 1.05, color: "#14171a" }}>
            Gratis gymzaal plattegrond in 3D
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 30, color: "#5b5f66" }}>Zonder account. Export als PNG of PDF.</div>
        </div>
        <div style={{ display: "flex", marginLeft: 24 }}>
          <IsoScene blocks={BLOCKS} svgWidth={560} svgHeight={420} />
        </div>
      </div>
    ),
    size,
  );
}
