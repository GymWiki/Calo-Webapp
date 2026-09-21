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
  // Security-audit (naar aanleiding van een Google Safe Browsing-melding):
  // geen eigen CSP/beveiligingsheaders vóór deze wijziging, dus een
  // eventuele toekomstige script-injectie zou door niets in de browser zelf
  // tegengehouden worden.
  //
  // `script-src 'self'` (zónder 'unsafe-inline') is EERDER geprobeerd en
  // brak de hele site: Next.js's App Router injecteert op ÉLKE pagina zelf
  // inline <script>-tags (de RSC/hydratie-payload — self.__next_f/__next_r
  // e.d.), volledig los van onze eigen code. Zonder 'unsafe-inline' worden
  // die door de browser geweigerd (console: "Refused to execute inline
  // script... script-src 'self'"), waardoor React nooit hydrateert. Zonder
  // hydratie is er geen enkele onSubmit-handler meer gekoppeld aan wélk
  // formulier dan ook — dus valt de browser terug op een kale HTML
  // form-submit (GET naar de huidige URL, met alle velden als
  // query-parameters — op /login dus ook het wachtwoord in leesbare tekst
  // in de adresbalk/geschiedenis/server-logs). Dat is precies de "volledige
  // pagina-herlaad bij een mislukte inlogpoging"-bug die dit heeft
  // veroorzaakt, en gold voor de HELE site, niet alleen /login.
  // Geverifieerd met een lokale Playwright-reproductie (next dev + een
  // mislukte inlogpoging): met 'unsafe-inline' verdwijnen de CSP-fouten en
  // blijft de submit een normale fetch-based server-action-aanroep.
  //
  // Het juiste alternatief zonder 'unsafe-inline' is een per-request nonce
  // via proxy.ts (Next.js's eigen aanbevolen aanpak), maar dat dwingt ALLE
  // pagina's af naar dynamic rendering — inclusief app/page.tsx, die nu
  // bewust `revalidate = 3600` gebruikt voor ISR. Die trade-off (geen
  // statische/ISR-caching meer, ergens tegen CLAUDE.md's performance-
  // standaard in) is een aparte, weloverwogen keuze en geen automatische
  // bijvangst van een CSP-fix — vandaar hier bewust 'unsafe-inline' i.p.v.
  // een halfslachtige nonce-migratie onder tijdsdruk.
  //
  // `style-src` had 'unsafe-inline' al nodig: React zet zelf inline
  // style-attributen (bijv. animationDelay in de scroll-reveal-animaties),
  // en een style-attribuut kan — in tegenstelling tot een script — sowieso
  // geen CSP-nonce dragen.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Vercel dwingt HTTPS al af op de edge, maar HSTS voorkomt dat een
          // client ooit over onversleuteld http:// naar deze host praat,
          // zelfs bij een verkeerd getypte/oude link.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // frame-ancestors hierboven dekt dit al af (moderner dan
          // X-Frame-Options) — GymWiki hoort nergens in een <iframe> van een
          // andere site te staan.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
