"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { linkNavigationTarget } from "@/components/canvas-3d/unsaved-navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Pending = {
  /** Verlaat de pagina (na bevestiging). */
  proceed: () => void;
  /** Blijven: herstelt wat de aanvraag al had weggehaald (bij de terugknop van de browser). */
  stay?: () => void;
};

/**
 * Waarschuwing bij het verlaten van de editor met wijzigingen die nog niet goed zijn opgeslagen (autosave loopt nog, of mislukte).
 * `beforeunload` (in de editor zelf) vangt sluiten, verversen en externe links af; dit vangt de rest af, waar de browser niets voor
 * toont: klikken op links in de app (menu, logo, bibliotheek, …), de terugknop van de browser of telefoon, de "Terug"-knop van de
 * editor en het openen van een andere plattegrond.
 *
 * De terugknop van de browser kan niet worden tegengehouden, alleen ongedaan gemaakt: zolang er niets bewaard is staat er daarom één
 * extra geschiedenisregel (zelfde URL) klaar. Een terug-gebaar haalt die weg, de waarschuwing verschijnt en "Blijven" zet hem terug.
 */
export function useUnsavedChangesGuard({
  unsaved,
  saveFailed,
  saveNow,
}: {
  unsaved: boolean;
  saveFailed: boolean;
  /** Slaat op en meldt of dat gelukt is. */
  saveNow: () => Promise<boolean>;
}): {
  dialog: ReactNode;
  /** Voert `proceed` uit, of toont eerst de waarschuwing als er onopgeslagen wijzigingen zijn. */
  request: (proceed: () => void) => void;
  /** Voor de "Terug"-knop: `true` = de waarschuwing is getoond, de knop moet niets doen. */
  interceptBack: (fallbackHref: string) => boolean;
} {
  const router = useRouter();
  const unsavedRef = useRef(unsaved);
  const bypassRef = useRef(false);
  const sentinelRef = useRef(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    unsavedRef.current = unsaved;
  }, [unsaved]);

  const request = useCallback((proceed: () => void) => {
    if (!unsavedRef.current || bypassRef.current) {
      proceed();
      return;
    }
    setPending({ proceed });
  }, []);

  /** Naar een andere pagina in de app. De extra geschiedenisregel wordt vervangen i.p.v. bewaard, zodat "terug" later niet twee keer nodig is. */
  const goTo = useCallback(
    (target: string) => {
      bypassRef.current = true;
      if (sentinelRef.current) router.replace(target);
      else router.push(target);
    },
    [router],
  );

  const interceptBack = useCallback(
    (fallbackHref: string) => {
      if (!unsavedRef.current || bypassRef.current) return false;
      setPending({
        proceed: () => {
          bypassRef.current = true;
          if (window.history.length > 1) window.history.go(sentinelRef.current ? -2 : -1);
          else router.push(fallbackHref);
        },
      });
      return true;
    },
    [router],
  );

  // Klikken op links binnen de app (capture: vóór de Link-component van Next).
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!unsavedRef.current || bypassRef.current || event.defaultPrevented) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const target = linkNavigationTarget(
        { href: anchor.href, target: anchor.getAttribute("target"), download: anchor.hasAttribute("download") },
        event,
        window.location.href,
      );
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      setPending({ proceed: () => goTo(target) });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [goTo]);

  // Extra geschiedenisregel zodra er iets onopgeslagen is.
  useEffect(() => {
    if (!unsaved || sentinelRef.current || bypassRef.current) return;
    window.history.pushState(window.history.state, "", window.location.href);
    sentinelRef.current = true;
  }, [unsaved]);

  // Terugknop van de browser of telefoon.
  useEffect(() => {
    function onPopState() {
      if (bypassRef.current || !sentinelRef.current) return;
      sentinelRef.current = false; // die regel is nu weg
      if (!unsavedRef.current) {
        window.history.back(); // alles was inmiddels bewaard: gewoon door naar de vorige pagina
        return;
      }
      setPending({
        proceed: () => {
          bypassRef.current = true;
          window.history.back();
        },
        stay: () => {
          window.history.pushState(window.history.state, "", window.location.href);
          sentinelRef.current = true;
        },
      });
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function close(leave: boolean) {
    const current = pending;
    setPending(null);
    if (!current) return;
    if (leave) current.proceed();
    else current.stay?.();
  }

  async function saveAndLeave() {
    setBusy(true);
    const ok = await saveNow().catch(() => false);
    setBusy(false);
    if (ok) close(true);
  }

  const dialog = (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open && !busy) close(false);
      }}
    >
      <DialogContent showCloseButton={false} overlayClassName="z-[70]" className="z-[70] sm:max-w-md" data-testid="onopgeslagen-dialoog">
        <DialogHeader>
          <DialogTitle>Wijzigingen nog niet opgeslagen</DialogTitle>
          <DialogDescription>
            {saveFailed
              ? "Opslaan is niet gelukt (controleer je verbinding). Als je nu weggaat, kunnen je laatste wijzigingen verloren gaan."
              : "Je laatste wijzigingen aan deze plattegrond zijn nog niet opgeslagen. Wil je ze eerst opslaan?"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start">
          <Button type="button" onClick={() => void saveAndLeave()} disabled={busy} data-testid="onopgeslagen-opslaan">
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Opslaan en verlaten
          </Button>
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={busy} data-testid="onopgeslagen-blijven">
            Blijven bewerken
          </Button>
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => close(true)} disabled={busy} data-testid="onopgeslagen-verlaten">
            Verlaten zonder opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { dialog, request, interceptBack };
}
