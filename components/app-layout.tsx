"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
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

function getNavItems(role: UserRole): NavItem[] {
  return [
    {
      href: role === "docent" ? "/docent/dashboard" : "/student/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    { href: "/zoeken", label: "Zoeken", icon: Search },
    { href: "/les-maken", label: "Les maken", icon: SquarePen },
    { href: "/profiel", label: "Profiel", icon: UserIcon },
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

  return (
    <div className="flex min-h-screen md:flex-row">
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-sidebar md:text-sidebar-foreground">
        <div className="px-6 py-5 text-lg font-semibold">GymBase</div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
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

      <div className="flex flex-1 flex-col pb-16 md:pb-0">
        <main className="flex-1">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t bg-background md:hidden">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
