import Link from "next/link";
import type { ReactNode } from "react";

/** Eenvoudige, leesbare shell voor juridische/infopagina's (privacy, voorwaarden, account verwijderen). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-8 sm:py-12">
      <nav aria-label="Navigatie">
        <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          ← GymWiki
        </Link>
      </nav>
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">Laatst bijgewerkt: {updated}</p>
      </header>
      <div className="space-y-4 text-sm leading-relaxed [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_h2]:pt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </main>
  );
}
