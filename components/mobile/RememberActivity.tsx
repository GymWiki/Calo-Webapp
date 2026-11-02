"use client";

import { useEffect } from "react";

/** Rendert niets; onthoudt deze activiteit in de native app voor het offline-scherm. */
export function RememberActivity({ id, title }: { id: string; title: string }) {
  useEffect(() => {
    void import("@/lib/mobile/offlineCache").then(({ rememberActivity }) => rememberActivity({ id, title }));
  }, [id, title]);
  return null;
}
