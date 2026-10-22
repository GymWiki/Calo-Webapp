"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/utils/supabase/client";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Wachtwoord moet minstens 8 tekens bevatten."),
    confirmPassword: z.string().min(1, "Herhaal je nieuwe wachtwoord."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Wachtwoorden komen niet overeen.",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

// Hoelang we wachten op het PASSWORD_RECOVERY-event voordat we de link als
// verlopen/ongeldig behandelen — ruim boven de tijd die de browser-client
// nodig heeft om de tokens uit de URL-hash te lezen en de sessie op te
// zetten (normaal < 1s), maar niet zo lang dat een écht ongeldige link de
// gebruiker minutenlang naar een lege pagina laat staren.
const RECOVERY_TIMEOUT_MS = 5000;

export function ResetPasswordForm() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "success">("checking");
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    const supabase = createClient();

    // De reset-link uit de e-mail draagt de tokens in de URL-hash; de
    // browser-client leest die automatisch bij het laden en vuurt dit event
    // zodra de (tijdelijke) recovery-sessie staat.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStatus("ready");
      }
    });

    // Val terug op een directe check: als de hash al vóór het aanmelden van
    // de listener hierboven verwerkt was, komt PASSWORD_RECOVERY nooit meer
    // langs, maar staat de sessie er dan al wél.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setStatus((current) => (current === "checking" ? "ready" : current));
      }
    });

    const timeout = setTimeout(() => {
      setStatus((current) => (current === "checking" ? "invalid" : current));
    }, RECOVERY_TIMEOUT_MS);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function onSubmit(values: ResetPasswordValues) {
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });

    if (error) {
      setFormError(
        error.code === "same_password"
          ? "Dit is je huidige wachtwoord al. Kies een ander wachtwoord."
          : "Er ging iets mis bij het instellen van je nieuwe wachtwoord. Probeer het opnieuw.",
      );
      return;
    }

    setStatus("success");
    setTimeout(() => {
      router.push("/login");
    }, 2000);
  }

  if (status === "checking") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <p>Je reset-link wordt gecontroleerd...</p>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          aria-live="polite"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>Deze link is ongeldig of verlopen. Vraag een nieuwe aan.</p>
        </div>
        <Button asChild className="w-full">
          <Link href="/wachtwoord-vergeten">Nieuwe link aanvragen</Link>
        </Button>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div role="status" aria-live="polite" className="flex items-start gap-2 text-sm text-muted-foreground">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        <p>Je wachtwoord is gewijzigd. Je wordt zo doorgestuurd naar het inlogscherm...</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nieuw wachtwoord</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Herhaal wachtwoord</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {formError && (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{formError}</p>
          </div>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Bezig met opslaan..." : "Wachtwoord instellen"}
        </Button>
      </form>
    </Form>
  );
}
