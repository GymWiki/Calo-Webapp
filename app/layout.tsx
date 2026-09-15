import type { Metadata } from "next";
import { Anton, Geist, Geist_Mono } from "next/font/google";
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

// Zet de `dark`-class op <html> vóórdat de pagina schildert (voorkomt een
// lichte flits bij het laden in dark mode) — moet hier als kale inline
// <script> staan omdat React zelf pas ná hydratie kan aanpassen, wat
// zichtbaar te laat is. Voorkeur: localStorage ("theme"), anders het
// systeemvoorkeur; zie ThemeToggle voor waar "theme" geschreven wordt.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nl"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col overflow-x-hidden">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
