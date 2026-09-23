import type { Metadata, Viewport } from "next";
import { Anton, Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { CapacitorBootstrap } from "@/components/mobile/CapacitorBootstrap";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Loaded globally (not just on the landing page) so `font-display` is
// available anywhere in the app — e.g. a big dashboard stat number.
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});

export const metadata: Metadata = {
  title: "GymWiki",
  description: "GymWiki 2.0 — platform voor CALO-studenten en vakdocenten lichamelijke opvoeding.",
  manifest: "/manifest.json",
};

// viewportFit: "cover" — zonder dit blijven env(safe-area-inset-*) overal 0,
// ook op plekken die al met die CSS-variabelen rekening houden (o.a.
// app-layout.tsx, activity-wizard-page.tsx) — WebKit (Safari én de
// Capacitor-iOS-WebView) negeert safe-area-inset-* totdat de viewport
// expliciet "cover" opeist. Was hiervoor nooit gezet: op het web viel dit
// niet op (de meeste content zit al ruim binnen de safe area), maar in de
// native app — waar de statusbalk-achtergrond tot aan de notch/Dynamic
// Island doorloopt (zie lib/mobile/capacitor.ts) — zou content daar zonder
// dit onder de systeem-UI verdwijnen.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#14171a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nl"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}
    >
      <head>
        {/* Zet de `dark`-class op <html> vóórdat de pagina schildert
            (voorkomt een lichte flits bij het laden in dark mode) — moet
            vóór hydratie draaien, wat zichtbaar te laat is als React het
            pas na hydratie zou doen (next/script strategy="beforeInteractive"
            regelt precies dat). Als extern bestand (public/theme-init.js,
            NIET inline) zodat de Content-Security-Policy (next.config.ts)
            zonder 'unsafe-inline' in script-src kan — een losstaande
            security-audit wees dit aan als het enige inline script in de
            hele app en dus de enige reden om die CSP-regel te verzwakken.
            Voorkeur: localStorage ("theme"), anders het systeemvoorkeur; zie
            components/theme-toggle.tsx voor waar "theme" geschreven wordt. */}
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <CapacitorBootstrap />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
