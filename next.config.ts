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
  // mammoth (Kennisbank-tekstextractie, .docx) doet native/CJS dingen die
  // niet door Next's server-bundelaar moeten worden herverpakt.
  // (PDF-tekstextractie liep eerst via pdf-parse/pdfjs-dist rechtstreeks —
  // dat gaf op Vercel achtereenvolgens "ReferenceError: DOMMatrix is not
  // defined" en "Setting up fake worker failed: Cannot find module
  // '.../pdf.worker.mjs'", beide het bekende pdfjs-dist-op-serverless-
  // compatibiliteitsprobleem. Vervangen door `unpdf`, dat een specifiek
  // voor serverless/edge gecompileerde PDF.js-build gebruikt zonder los
  // worker-bestand of native canvas-afhankelijkheid — zie
  // lib/ai/documentText.ts.)
  serverExternalPackages: ["mammoth"],
  // Activiteit-/materiaalafbeeldingen komen van twee externe hosts: de
  // oorspronkelijk geïmporteerde bibliotheek-activiteiten verwijzen nog naar
  // de vroegere Firebase Storage-bucket, alles wat ná de Supabase-migratie
  // is geüpload (materialen, canvas-plattegrond-exports, nieuwe
  // activiteit-foto's) staat in Supabase Storage. Wildcard op het
  // projectsubdomein i.p.v. de exacte projectref, zodat dit niet breekt als
  // het Supabase-project ooit verhuist.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
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
