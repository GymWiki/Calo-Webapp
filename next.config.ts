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
  // (Eerder stond hier ook @napi-rs/canvas — pdf-parse's optionele, native
  // DOMMatrix-polyfill voor pdfjs-dist. Die package wordt op Vercel niet
  // betrouwbaar meegebundeld [dynamische require() diep in pdfjs-dist, niet
  // statisch detecteerbaar door de file-tracer], wat alsnog "ReferenceError:
  // DOMMatrix is not defined" gaf. Vervangen door een eigen, pure-JS
  // polyfill vóór de pdf-parse-import — zie lib/ai/domMatrixPolyfill.ts.)
  serverExternalPackages: ["pdf-parse", "mammoth"],
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
