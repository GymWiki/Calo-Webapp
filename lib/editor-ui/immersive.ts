// Routes waar de editor het hele scherm vult (op mobiel zonder globale kop en onderste navigatiebalk). Eén plek: nieuwe editorpagina's
// (gratis editor, beheer-concepten) voegen hier hun pad toe en erven de schermvullende modus van AppLayout.
export const IMMERSIVE_ROUTE_PREFIXES: readonly string[] = ["/plattegrond-3d", "/e2e/shell-plattegrond-3d"];

export function isImmersiveRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return IMMERSIVE_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
