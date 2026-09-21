"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { TriangleAlert } from "lucide-react";
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
import { PasswordInput } from "@/components/ui/password-input";
import { login } from "@/app/(auth)/actions";

const loginSchema = z.object({
  email: z.string().email("Vul een geldig e-mailadres in."),
  password: z.string().min(1, "Wachtwoord is verplicht."),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    const result = await login(values);

    if ("error" in result) {
      setFormError(result.error);
      // E-mailadres blijft staan (field-waarde wordt hierboven niet
      // aangeraakt — react-hook-form reset velden alleen als je zelf reset()
      // aanroept). Het wachtwoord wissen we bewust wél: voorkomt dat een
      // eerder getypt wachtwoord onnodig in de form-state/DOM blijft hangen,
      // en de gebruiker moet er sowieso opnieuw naartoe om het te herproberen.
      form.resetField("password", { defaultValue: "" });
      form.setFocus("password");
      return;
    }

    router.push("/dashboard");
    router.refresh();
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
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-2">
                <FormLabel>Wachtwoord</FormLabel>
                <Link
                  href="/wachtwoord-vergeten"
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  Wachtwoord vergeten?
                </Link>
              </div>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {formError && (
          // aria-live kondigt de melding aan zonder de focus te verplaatsen
          // (die gaat hieronder expliciet naar het wachtwoordveld) — role="alert"
          // is de bredere browserondersteunde variant van hetzelfde idee.
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
          {form.formState.isSubmitting ? "Bezig met inloggen..." : "Inloggen"}
        </Button>
      </form>
    </Form>
  );
}
