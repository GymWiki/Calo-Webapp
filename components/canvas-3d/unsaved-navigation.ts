// Pure hulpfuncties voor de waarschuwing bij het verlaten van de editor met onopgeslagen wijzigingen
// (zie useUnsavedChangesGuard.tsx): welke klik op een link verlaat de pagina echt?

export type ClickedAnchor = { href: string; target?: string | null; download?: boolean };
export type ClickInfo = { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean };

/**
 * Bestemming (pad + query + hash) van een klik op een link binnen de app, of `null` als de klik de pagina niet verlaat: een
 * link naar een andere site (de browser waarschuwt daar zelf via `beforeunload`), een nieuw tabblad of venster, een download, een
 * klik met een toetscombinatie of de middelste/rechter muisknop, en een link naar dezelfde pagina (alleen een andere hash).
 */
export function linkNavigationTarget(anchor: ClickedAnchor, click: ClickInfo, currentUrl: string): string | null {
  if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  if (anchor.download) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  let to: URL;
  let from: URL;
  try {
    from = new URL(currentUrl);
    to = new URL(anchor.href, from);
  } catch {
    return null;
  }
  if (to.origin !== from.origin) return null;
  if (to.protocol !== "http:" && to.protocol !== "https:") return null;
  if (to.pathname === from.pathname && to.search === from.search) return null;
  return `${to.pathname}${to.search}${to.hash}`;
}
