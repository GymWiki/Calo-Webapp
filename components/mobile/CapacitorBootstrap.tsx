"use client";

import { useEffect } from "react";

/**
 * Rendert niets — regelt alleen de eenmalige native-app-bootstrap (status
 * bar, splash-screen-afhandeling, Android-terugknop, zie
 * lib/mobile/capacitor.ts). Gemount in app/layout.tsx, dus op ELKE pagina —
 * ook voor de overgrote meerderheid bezoekers die gewoon via de browser op
 * www.gymwiki.nl komen en dit nooit nodig hebben. @capacitor/core (en de
 * losse plugin-packages die initializeNativeApp zelf al lazy import't)
 * mogen daarom niet in de gedeelde/globale bundel belanden — vandaar de
 * dynamische import hier i.p.v. een gewone top-level import, zelfde
 * code-splitting-patroon als components/pdf/ActivityPdfButton.tsx (zie
 * CLAUDE.md's performance-standaard).
 */
export function CapacitorBootstrap() {
  useEffect(() => {
    // De native runtime injecteert `window.Capacitor` vóórdat de pagina
    // laadt — een gewone browser op www.gymwiki.nl heeft dit nooit. Deze
    // check kost niets (geen import) en voorkomt dat de dynamische import
    // hieronder — en daarmee @capacitor/core zelf — voor de overgrote
    // meerderheid webbezoekers ook maar wordt OPGEHAALD, niet alleen
    // "niet uitgevoerd".
    if (typeof window === "undefined" || !("Capacitor" in window)) return;

    void import("@/lib/mobile/capacitor").then(({ initializeNativeApp }) => initializeNativeApp());
  }, []);

  return null;
}
