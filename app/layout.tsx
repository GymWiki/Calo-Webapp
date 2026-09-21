import type { Metadata } from "next";
import { Anton, Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
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
        {children}
        <Toaster />
      </body>
    </html>
  );
}
