import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Next.js' eigen bestandsconventie voor Open Graph/Twitter-preview-
// afbeeldingen — genereert automatisch de og:image/twitter:image-meta-tags.
// Het logo wordt als data-URL ingelezen (ImageResponse/Satori kan geen
// netwerk-fetch tijdens het renderen betrouwbaar garanderen) en op de
// merk-navy achtergrond gezet i.p.v. het kale logo zelf.
export const alt = "GymWiki — Activiteiten en lesideeën voor bewegingsonderwijs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logoDataUrl = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public/gymwiki-logo.png"),
).toString("base64")}`;

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          backgroundColor: "#002f4f",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <img
          src={logoDataUrl}
          alt=""
          width={120}
          height={120}
          style={{ marginBottom: 40, borderRadius: 28 }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 88,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#f6f5f1",
          }}
        >
          GYMWIKI
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 34,
            color: "#f6f5f1",
            opacity: 0.85,
            maxWidth: 880,
          }}
        >
          Activiteiten en lesideeën voor bewegingsonderwijs
        </div>
      </div>
    ),
    { ...size },
  );
}
