"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Crown,
  Database,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  SquarePen,
  User as UserIcon,
} from "lucide-react";

import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

// The four items everyone needs at a thumb's reach — kept lean so the
// mobile bottom nav never crowds. The rest live in SECONDARY_NAV_ITEMS,
// sidebar-only on desktop.
const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/zoeken", label: "Bibliotheek", icon: BookOpen },
  { href: "/les-maken", label: "Activiteit maken", icon: SquarePen },
  { href: "/profiel", label: "Profiel", icon: UserIcon },
];

const SECONDARY_NAV_ITEMS: NavItem[] = [
  { href: "/kennisbank", label: "Kennisbank", icon: Database },
  { href: "/pro", label: "Abonnement", icon: Crown },
];

// Exacte-of-subroute-match i.p.v. kale pathname.startsWith(item.href): met
// startsWith alleen matchte "/profiel" ook per ongeluk tegen href "/pro"
// (Abonnement) — "/profiel".startsWith("/pro") is true, dus die tab kleurde
// ook actief mee terwijl je op je profiel zat. Deze helper staat wél toe dat
// een subroute (bijv. "/profiel/activiteiten", zie de Concepten/Activiteiten-
// tabbladen) zijn ouder-tab "Profiel" als actief aanmerkt, want die begint
// met "/profiel/" — een exacte prefix-grens i.p.v. een losse tekst-match.
function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const navItems = NAV_ITEMS;
  const secondaryNavItems = SECONDARY_NAV_ITEMS;
  const [moreOpen, setMoreOpen] = useState(false);
  // Kennisbank/Abonnement zaten voorheen alleen in de desktop-zijbalk — op
  // mobiel was er geen enkele weg naar die pagina's. "Meer" is de 5e (en
  // laatste toegestane) bottom-nav-plek, opent een Sheet met de rest.
  const isMoreActive = secondaryNavItems.some((item) => isNavItemActive(pathname, item.href));

  function navLinkClass(isActive: boolean) {
    return cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ease-brand",
      isActive
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    );
  }

  return (
    <div className="flex min-h-dvh w-full md:flex-row">
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-sidebar md:text-sidebar-foreground print:hidden">
        <div className="font-display px-6 py-5 text-lg tracking-wide">
          GYMWIKI
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => {
            const isActive = isNavItemActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={navLinkClass(isActive)}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}

          {secondaryNavItems.length > 0 && (
            <>
              <p className="mt-5 mb-1 px-3 font-mono text-[10px] font-semibold tracking-[0.14em] text-sidebar-foreground/40 uppercase">
                Meer
              </p>
              {secondaryNavItems.map((item) => {
                const isActive = isNavItemActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={navLinkClass(isActive)}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>
        <form action={logout} className="border-t p-3">
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start gap-3"
          >
            <LogOut className="size-4" />
            Uitloggen
          </Button>
        </form>
      </aside>

      {/* pb-16 was een vaste 4rem — precies de hoogte van de bottom-nav
          hieronder zolang die zelf geen safe-area-padding had. Nu die balk
          op toestellen met een gebarenbalk (iOS/Android) env(safe-area-
          inset-bottom) extra hoogte krijgt, moet de content-padding daarin
          meegroeien, anders verdwijnt het laatste stukje content er alsnog
          achter. */}
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 print:pb-0">
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Geen h-16 meer op de nav zelf — pb-[env(safe-area-inset-bottom)]
          voegt onderin extra ruimte toe die met de balk meegroeit i.p.v. 'm
          in een vaste 64px te persen (waardoor de iconen/labels op
          toestellen met een gebarenbalk té laag, deels achter die balk,
          zouden komen te staan). Elke tab krijgt zelf h-16 zodat het
          klikbare oppervlak exact hetzelfde blijft als voorheen — de
          safe-area-ruimte is puur onklikbare buffer eronder. */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex shrink-0 transform-gpu border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden print:hidden">
        {navItems.map((item) => {
          const isActive = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-16 flex-1 shrink-0 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-150 ease-brand",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-5 shrink-0 transition-transform duration-150 ease-brand",
                  isActive && "-translate-y-0.5",
                )}
              />
              <span className="shrink-0 leading-none whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
        {secondaryNavItems.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(
              "flex h-16 flex-1 shrink-0 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-150 ease-brand",
              isMoreActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <MoreHorizontal
              className={cn(
                "size-5 shrink-0 transition-transform duration-150 ease-brand",
                isMoreActive && "-translate-y-0.5",
              )}
            />
            <span className="shrink-0 leading-none whitespace-nowrap">Meer</span>
          </button>
        )}
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader>
            <SheetTitle>Meer</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-4 pt-0">
            {secondaryNavItems.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors duration-150 ease-brand",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-accent",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
            <form action={logout} className="mt-2 border-t pt-3">
              <Button type="submit" variant="ghost" className="w-full justify-start gap-3">
                <LogOut className="size-4" />
                Uitloggen
              </Button>
            </form>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
