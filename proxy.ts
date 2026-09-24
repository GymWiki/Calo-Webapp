import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/middleware";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/les-maken",
  "/les",
  "/activiteit",
  "/zoeken",
  "/kennisbank",
  "/profiel",
  "/toernooi",
  "/pro",
];

// Publicly reachable even though they start with a protected prefix above
// ("/les") — shared-link visitors are frequently not logged in at all.
const PUBLIC_EXCEPTIONS = ["/les/share"];

function isProtectedPath(pathname: string) {
  if (
    PUBLIC_EXCEPTIONS.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return false;
  }

  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Copies the (possibly refreshed) auth cookies from `source` onto `target`
// so a redirect response never drops a session that was just refreshed.
function withCookiesFrom(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

// Achtergrond-prefetches (Next.js's <Link>-router-prefetch, of de generieke
// `purpose: prefetch`-conventie) renderen nooit iets voor de gebruiker — een
// auth-check hier is verspilde Supabase Auth-rate-limit-budget en kan niet
// via de statische matcher hieronder worden uitgesloten (headers zijn daar
// niet zichtbaar), dus dat gebeurt hier at runtime.
function isPrefetchRequest(request: NextRequest) {
  return (
    request.headers.get("next-router-prefetch") !== null ||
    request.headers.get("purpose") === "prefetch"
  );
}

// getUser() gooit geen exception bij een Supabase Auth-fout — het geeft
// { data: { user: null }, error } terug (zelfde conventie als overal elders
// in deze codebase). Bij een 429/over_request_rate_limit betekent een lege
// `user` dus niet "niet ingelogd": we mogen dan niet naar /login redirecten,
// want dat zou een wél ingelogde gebruiker eruit gooien zodra Auth tijdelijk
// rate-limit't.
function isRateLimitError(error: { status?: number; code?: string } | null) {
  if (!error) return false;
  return error.status === 429 || error.code === "over_request_rate_limit";
}

export async function proxy(request: NextRequest) {
  if (isPrefetchRequest(request)) {
    return NextResponse.next();
  }

  const { supabase, response } = createClient(request);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname) && !user && !isRateLimitError(error)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return withCookiesFrom(NextResponse.redirect(loginUrl), response);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/|sw\\.js|workbox-.*\\.js|manifest\\.json|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|map|woff|woff2|ttf)$).*)",
  ],
};
