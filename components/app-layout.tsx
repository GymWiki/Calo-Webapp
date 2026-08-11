"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Handshake,
  LayoutDashboard,
  LogOut,
  NotebookText,
  Search,
  SquarePen,
  User as UserIcon,
} from "lucide-react";

import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

// The four items every role needs at a thumb's reach — kept lean so the
// mobile bottom nav never crowds. Role-specific extras live in
// getSecondaryNavItems, sidebar-only on desktop.
function getNavItems(role: UserRole): NavItem[] {
  return [
    {
      href: role === "docent" ? "/docent/dashboard" : "/student/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    { href: "/zoeken", label: "Activiteiten", icon: Search },
    { href: "/les-maken", label: "Les maken", icon: SquarePen },
    { href: "/profiel", label: "Profiel", icon: UserIcon },
  ];
}

function getSecondaryNavItems(role: UserRole): NavItem[] {
  if (role === "docent") {
    return [{ href: "/bibliotheek", label: "Bibliotheek", icon: BookOpen }];
  }
  return [
    { href: "/bibliotheek", label: "Bibliotheek", icon: BookOpen },
    { href: "/student/marktplaats", label: "Marktplaats", icon: Handshake },
    { href: "/student/stage-logboek", label: "Stage-logboek", icon: NotebookText },
  ];
}

export function AppLayout({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const navItems = getNavItems(role);
  const secondaryNavItems = getSecondaryNavItems(role);

  function navLinkClass(isActive: boolean) {
    return cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ease-brand",
      isActive
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    );
  }

  return (
    <div className="flex min-h-screen w-full md:flex-row">
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-sidebar md:text-sidebar-foreground print:hidden">
        <div className="font-display px-6 py-5 text-lg tracking-wide">
          GYMBASE
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
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
                const isActive = pathname.startsWith(item.href);
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

      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0 print:pb-0">
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t bg-background/95 backdrop-blur-sm md:hidden print:hidden">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors duration-150 ease-brand",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-5 transition-transform duration-150 ease-brand",
                  isActive && "-translate-y-0.5",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
