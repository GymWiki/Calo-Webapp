"use client";

// Vangt elke onverwachte renderfout op ELKE pagina binnen (protected) op
// (bijv. een Supabase-query die faalt — zie de throw new Error(...)-patronen
// in lib/services/activities.ts, gebruikt door o.a. het dashboard). Zonder
// dit bestand bestond er NERGENS in de app een error.tsx: een fout in één
// enkele pagina liep dan helemaal door tot aan Next's kale, generieke
// foutpagina — die vervangt de volledige boom INCLUSIEF (protected)/layout.tsx,
// dus ook AppLayout en daarmee de navigatiebalk verdwenen dan volledig mee.
// Dit bestand hangt ONDER (protected)/layout.tsx in de boom, dus AppLayout
// (en de navigatiebalk) blijft nu altijd gewoon staan — alleen het
// pagina-gedeelte valt terug op deze melding.
import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Onverwachte fout binnen (protected):", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-8">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" aria-hidden="true" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold">Er ging iets mis</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Deze pagina kon niet geladen worden. Probeer het opnieuw — de rest
          van GymWiki blijft gewoon bereikbaar via de navigatie.
        </p>
      </div>
      <Button type="button" onClick={reset}>
        <RotateCcw className="size-4" />
        Probeer opnieuw
      </Button>
    </main>
  );
}
