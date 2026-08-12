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
  "/bibliotheek",
  "/marktplaats",
  "/stage-logboek",
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

export async function proxy(request: NextRequest) {
  const { supabase, response } = createClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return withCookiesFrom(NextResponse.redirect(loginUrl), response);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
