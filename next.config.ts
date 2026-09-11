import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  // @ducanh2912/next-pwa always attaches a `webpack` config, even when
  // disabled, which Turbopack (the `next dev` default) treats as an error.
  // Production builds opt back into webpack via `next build --webpack` so
  // the service worker still gets generated.
  turbopack: {},
  // pdf-parse/mammoth (Kennisbank-tekstextractie) doen native/CJS dingen
  // die niet door Next's server-bundelaar moeten worden herverpakt.
  // @napi-rs/canvas is pdf-parse's (via pdfjs-dist) Node-polyfill voor
  // DOMMatrix/ImageData/Path2D — zonder deze package (of als de bundelaar
  // 'm herverpakt) crasht elke pdf-parse-aanroep in productie met
  // "ReferenceError: DOMMatrix is not defined", want pdfjs-dist's
  // legacy Node-build construeert op module-top-level al een DOMMatrix.
  serverExternalPackages: ["pdf-parse", "mammoth", "@napi-rs/canvas"],
  experimental: {
    serverActions: {
      // createLesson's payload can include a base64 PNG of the exported
      // gym-floor diagram; the Kennisbank-upload kan een PDF/Word-bestand
      // tot 20MB zijn (zie KNOWLEDGE_MAX_FILE_SIZE_BYTES) — de 1MB default
      // is voor beide te tight.
      bodySizeLimit: "20mb",
    },
  },
};

export default withPWA(nextConfig);
