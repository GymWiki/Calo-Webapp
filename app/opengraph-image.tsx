import { ImageResponse } from "next/og";

// Next.js' eigen bestandsconventie voor Open Graph/Twitter-preview-
// afbeeldingen — genereert automatisch de og:image/twitter:image-meta-tags,
// geen handmatige asset nodig (er staat geen logo-bestand in deze repo, zie
// scripts/generate-app-icon.mjs's toelichting daarover). Zelfde
// kegel-beeldidioom/kleuren (--ink/--cone uit app/globals.css) als het
// mobile-app-icoon en de landingspagina's HeroCourtIllustration, puur zodat
// een gedeelde link herkenbaar oogt ongeacht waar 'm gedeeld wordt.
export const alt = "GymWiki — Activiteiten en lesideeën voor bewegingsonderwijs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          backgroundColor: "#14171a",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 84,
            height: 84,
            borderRadius: "50%",
            backgroundColor: "#ff5a1f",
            marginBottom: 40,
          }}
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
