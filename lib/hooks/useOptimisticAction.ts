"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

/**
 * Gedeeld patroon voor "werk de UI nu bij, corrigeer alleen als de
 * server-aanroep daadwerkelijk faalt" — de instant-reagerende-UI-standaard
 * (zie ARCHITECTURE.md): elke gebruikersactie moet binnen ~100ms zichtbaar
 * reageren, ook als de onderliggende server action langer duurt.
 *
 * Vóór deze hook implementeerde elke plek die dit nodig had (de
 * bewaren-knop op de activiteit-detailpagina, de
 * beschikbaar-voor-stage-toggle, ...) hetzelfde `useState` +
 * `useTransition` + revert-bij-fout-patroon apart, met het risico dat een
 * nieuwe plek het net iets anders — en subtiel fout — implementeert (zie de
 * performance-audit). `action` moet het in deze codebase gangbare
 * server-action-resultaattype teruggeven: een discriminated union met een
 * `error: string`-tak bij falen (zie bijv. actions/activity.ts's
 * `ToggleResult`, actions/profile.ts's `ActionResult`).
 */
export function useOptimisticAction<T, R extends object>(
  initialValue: T,
  action: (next: T) => Promise<R>,
  options?: {
    /** Aangeroepen ná een geslaagde server-aanroep, met het resultaat. */
    onSuccess?: (result: R, next: T) => void;
  },
) {
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  function run(next: T) {
    const previous = value;
    setValue(next); // optimistic

    startTransition(async () => {
      const result = await action(next);
      // `"error" in result`-check i.p.v. een `{ error?: string }`-generic-
      // constraint: TypeScript's "weak type"-detectie zou anders elke
      // server-actionresultaat zonder gedeelde velden (bijv.
      // `{ success: true; saved: boolean }`) afwijzen, ook al is dat
      // precies het gangbare succes-type in deze codebase.
      if ("error" in result && typeof result.error === "string") {
        setValue(previous); // revert
        toast.error(result.error);
        return;
      }
      options?.onSuccess?.(result, next);
    });
  }

  return { value, setValue, run, isPending };
}
