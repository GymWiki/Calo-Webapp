import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResetPasswordForm } from "./reset-password-form";

// Bewust BUITEN de (auth)-routegroep: (auth)/layout.tsx redirect elke
// ingelogde bezoeker naar /dashboard, maar het klikken op een
// wachtwoord-reset-link in de e-mail logt de gebruiker juist tijdelijk in
// (een "recovery"-sessie, zie reset-password-form.tsx) — met die layout
// erboven zou deze pagina zichzelf dus direct wegredirecten vóórdat de
// gebruiker een nieuw wachtwoord kon instellen.
export default function ResetPasswordPage() {
  return (
    <main className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-paper p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none"
      >
        <div className="absolute top-10 -right-20 size-64 rotate-6 rounded-3xl border-4 border-cone/15 sm:size-80" />
        <div className="absolute -bottom-20 -left-16 size-56 -rotate-3 rounded-3xl border-4 border-line-blue/10 sm:size-72" />
      </div>

      <Link
        href="/"
        className="animate-fade-up font-display relative z-10 mb-8 text-2xl tracking-wide text-ink"
      >
        GYMWIKI
      </Link>

      <div
        className="animate-fade-up relative z-10 w-full max-w-sm"
        style={{ animationDelay: "60ms" }}
      >
        <Card className="w-full shadow-brand-lg">
          <CardHeader>
            <CardTitle className="text-xl">Nieuw wachtwoord instellen</CardTitle>
            <CardDescription>Kies een nieuw wachtwoord voor je GymWiki-account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ResetPasswordForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
