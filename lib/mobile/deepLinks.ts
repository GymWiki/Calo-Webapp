// Vertaalt een geopende link (universal/app link naar gymwiki.nl of het eigen
// URL-schema van de app) naar een pad binnen de webapp. Puur en getest.

const WEB_HOSTS = new Set(["www.gymwiki.nl", "gymwiki.nl"]);

/** Paden die nooit in de app geopend worden (auth-callbacks e.d. blijven waar ze zijn). */
const BLOCKED_PREFIXES = ["/api/"];

export function resolveDeepLink(rawUrl: string, scheme = "com.mycompany.gymwiki"): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  let path: string;
  if (url.protocol === "https:" && WEB_HOSTS.has(url.hostname)) {
    path = url.pathname;
  } else if (url.protocol === `${scheme}:`) {
    // com.mycompany.gymwiki://activiteit/123 → host = "activiteit"
    path = `/${url.host}${url.pathname}`.replace(/\/+$/, "") || "/";
  } else {
    return null;
  }

  if (!path.startsWith("/") || path.startsWith("//") || BLOCKED_PREFIXES.some((p) => path.startsWith(p))) return null;
  return `${path}${url.search}`;
}
