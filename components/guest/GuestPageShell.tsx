import Link from "next/link";

import { GymWikiLogo } from "@/components/GymWikiLogo";
import { Button } from "@/components/ui/button";
import { GUEST_TOOL_PATH } from "@/lib/guest/constants";

/** Eenvoudige publieke kop en voet voor de (indexeerbare) gratis-toolpagina's. */
export function GuestPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
        <GymWikiLogo size={32} href="/" wordmarkClassName="text-xl" />
        <nav aria-label="Hoofdmenu" className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-foreground/70 underline-offset-4 hover:text-foreground hover:underline">
            Inloggen
          </Link>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/register">Gratis account</Link>
          </Button>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-sm text-muted-foreground sm:px-8">
        <nav aria-label="Meer van GymWiki" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/" className="underline-offset-4 hover:underline">GymWiki</Link>
          <Link href={GUEST_TOOL_PATH} className="underline-offset-4 hover:underline">Gratis 3D-plattegrond maken</Link>
          <Link href="/activiteiten" className="underline-offset-4 hover:underline">Activiteiten</Link>
          <Link href="/over-gymwiki" className="underline-offset-4 hover:underline">Over GymWiki</Link>
        </nav>
        <p className="mt-3 text-xs">GymWiki — gebouwd voor CALO-studenten en vakdocenten lichamelijke opvoeding.</p>
      </footer>
    </div>
  );
}
