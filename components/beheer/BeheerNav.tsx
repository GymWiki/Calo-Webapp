"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/beheer", label: "Activiteiten", exact: true },
  { href: "/beheer/ai-import", label: "AI-import" },
  { href: "/beheer/taalcheck", label: "Taalcheck" },
  { href: "/kennisbank/beheer", label: "Kennisbank" },
];

export function BeheerNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Beheer" className="mx-auto w-full max-w-6xl overflow-x-auto px-4 pt-4 sm:px-8">
      <ul className="flex min-w-max gap-1 border-b">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href || pathname.startsWith("/beheer/activiteiten") : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors",
                  active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
