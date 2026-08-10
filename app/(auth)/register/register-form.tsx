"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
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
import { cn } from "@/lib/utils";
import { register } from "@/app/(auth)/actions";

const registerSchema = z.object({
  firstName: z.string().min(1, "Voornaam is verplicht."),
  lastName: z.string().min(1, "Achternaam is verplicht."),
  email: z.string().email("Vul een geldig e-mailadres in."),
  password: z.string().min(8, "Wachtwoord moet minstens 8 tekens bevatten."),
  role: z.enum(["student", "docent"]),
});

type RegisterValues = z.infer<typeof registerSchema>;

const roleOptions: { value: RegisterValues["role"]; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "docent", label: "Docent" },
];

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "student",
    },
  });

  async function onSubmit(values: RegisterValues) {
    setFormError(null);
    const result = await register(values);

    if ("error" in result) {
      setFormError(result.error);
      return;
    }

    if (result.needsEmailConfirmation) {
      setConfirmationSent(true);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  const selectedRole = useWatch({ control: form.control, name: "role" });

  if (confirmationSent) {
    return (
      <p className="text-sm text-muted-foreground">
        Bijna klaar! Check je e-mail om je account te bevestigen voordat je
        kunt inloggen.
      </p>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Voornaam</FormLabel>
                <FormControl>
                  <Input autoComplete="given-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Achternaam</FormLabel>
                <FormControl>
                  <Input autoComplete="family-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
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
              <FormLabel>Wachtwoord</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={() => (
            <FormItem>
              <FormLabel>Ik ben een</FormLabel>
              <div
                className="grid grid-cols-2 gap-2"
                role="radiogroup"
                aria-label="Rol"
              >
                {roleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selectedRole === option.value}
                    onClick={() =>
                      form.setValue("role", option.value, {
                        shouldValidate: true,
                      })
                    }
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      selectedRole === option.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        {formError && <p className="text-sm text-destructive">{formError}</p>}
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting
            ? "Account aanmaken..."
            : "Account aanmaken"}
        </Button>
      </form>
    </Form>
  );
}
