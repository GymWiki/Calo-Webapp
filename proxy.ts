import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/middleware";
import type { UserRole } from "@/lib/types";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/student",
  "/docent",
  "/les-maken",
  "/les",
  "/zoeken",
  "/profiel",
];

function isProtectedPath(pathname: string) {
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

  if (pathname === "/dashboard" && user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = (profile?.role as UserRole | undefined) ?? "student";
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = role === "docent" ? "/docent/dashboard" : "/student/dashboard";
    return withCookiesFrom(NextResponse.redirect(dashboardUrl), response);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
