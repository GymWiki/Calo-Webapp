"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { MailCheck, TriangleAlert } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/app/(auth)/actions";

const forgotPasswordSchema = z.object({
  email: z.string().email("Vul een geldig e-mailadres in."),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setFormError(null);
    const result = await requestPasswordReset(values);

    if ("error" in result) {
      setFormError(result.error);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" aria-live="polite" className="flex items-start gap-2 text-sm text-muted-foreground">
        <MailCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        <p>
          Als dit e-mailadres bij ons bekend is, hebben we er zojuist een
          link naartoe gestuurd om je wachtwoord opnieuw in te stellen.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mailadres</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" autoFocus {...field} />
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
          {form.formState.isSubmitting ? "Bezig met versturen..." : "Verstuur reset-link"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Terug naar inloggen
          </Link>
        </p>
      </form>
    </Form>
  );
}
