"use client";

import { useEffect, useState } from "react";

/**
 * React-hook-variant van isNativeApp() (zie lib/mobile/capacitor.ts) voor
 * client components die hun render moeten aanpassen (bijv. de betaalmuur —
 * zie components/ProCheckoutButton.tsx) i.p.v. alleen een side-effect
 * uitvoeren. Start bewust op `false` (correct voor de eerste render op elk
 * platform, óók native — window.Capacitor bestaat pas na mount) zodat SSR
 * en de eerste client-render altijd overeenkomen; een fractie na mount
 * springt native-app-gebruikers naar `true`.
 *
 * Zelfde `window.Capacitor`-guard + dynamische import als
 * components/mobile/CapacitorBootstrap.tsx: @capacitor/core wordt voor de
 * overgrote meerderheid webbezoekers niet eens opgehaald.
 */
export function useIsNativeApp(): boolean {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Capacitor" in window)) return;

    let cancelled = false;
    void import("@capacitor/core").then(({ Capacitor }) => {
      if (!cancelled) setIsNative(Capacitor.isNativePlatform());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return isNative;
}
