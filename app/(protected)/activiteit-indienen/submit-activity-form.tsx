"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { submitActivity } from "@/actions/activity-submission";
import { DynamicTextList } from "@/app/(protected)/les-maken/dynamic-text-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LEARNING_LINE_CATEGORIES } from "@/lib/constants/learningLines";
import {
  CATEGORIE_WAARDEN,
  DOELGROEP_LABELS,
  DOELGROEP_WAARDEN,
  submitActivityInputSchema,
  type SubmitActivityInput,
} from "@/types/activity";

const SELECT_CLASS =
  "border-input mt-1.5 flex h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const DEFAULT_VALUES: SubmitActivityInput = {
  titel: "",
  categorie: CATEGORIE_WAARDEN[0],
  leerlijn: "",
  doelgroep: [],
  beschrijving: "",
  beginsituatie: "",
  doel: "",
  veld: "",
  materiaal: [],
  regels: [],
  loopt: [],
  lukt: [],
  leeft: [],
};

type Outcome =
  | { status: "approved" }
  | { status: "rejected"; reason: string };

export function SubmitActivityForm() {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const form = useForm<SubmitActivityInput>({
    resolver: zodResolver(submitActivityInputSchema),
    defaultValues: DEFAULT_VALUES,
  });

  async function onSubmit(values: SubmitActivityInput) {
    setOutcome(null);
    const result = await submitActivity(values);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    if (result.status === "approved") {
      setOutcome({ status: "approved" });
      toast.success("Activiteit goedgekeurd en toegevoegd aan de bibliotheek!");
      form.reset(DEFAULT_VALUES);
      router.refresh();
    } else {
      setOutcome({ status: "rejected", reason: result.reason });
    }
  }

  function toggleDoelgroep(waarde: number) {
    const current = form.getValues("doelgroep");
    form.setValue(
      "doelgroep",
      current.includes(waarde)
        ? current.filter((v) => v !== waarde)
        : [...current, waarde],
      { shouldValidate: true },
    );
  }

  return (
    <div className="space-y-6">
      {outcome && (
        <Card
          className={
            outcome.status === "approved"
              ? "border-success/40 bg-success/5"
              : "border-destructive/40 bg-destructive/5"
          }
        >
          <CardContent className="flex items-start gap-3 py-4">
            {outcome.status === "approved" ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            ) : (
              <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            )}
            <div>
              <p className="font-semibold">
                {outcome.status === "approved" ? "Goedgekeurd" : "Afgekeurd"}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {outcome.status === "approved"
                  ? "Deze activiteit is direct zichtbaar in de bibliotheek en telt mee voor je maandquotum."
                  : outcome.reason}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="titel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Titel</FormLabel>
                <FormControl>
                  <Input placeholder="Bijv. Kooien-tikkertje" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="categorie"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categorie</FormLabel>
                  <FormControl>
                    <select className={SELECT_CLASS} {...field}>
                      {CATEGORIE_WAARDEN.map((waarde) => (
                        <option key={waarde} value={waarde}>
                          {waarde}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="leerlijn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Leerlijn</FormLabel>
                  <FormControl>
                    <select className={SELECT_CLASS} {...field}>
                      <option value="" disabled>
                        Kies een leerlijn
                      </option>
                      {LEARNING_LINE_CATEGORIES.map(({ category, lines }) => (
                        <optgroup key={category} label={category}>
                          {lines.map((line) => (
                            <option key={line} value={line}>
                              {line}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div>
            <Label>Doelgroep</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {DOELGROEP_WAARDEN.map((waarde) => {
                const active = form.watch("doelgroep").includes(waarde);
                return (
                  <button
                    key={waarde}
                    type="button"
                    onClick={() => toggleDoelgroep(waarde)}
                    className={
                      active
                        ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                        : "rounded-full border px-3 py-1.5 text-sm text-muted-foreground"
                    }
                  >
                    {DOELGROEP_LABELS[waarde]}
                  </button>
                );
              })}
            </div>
            {form.formState.errors.doelgroep && (
              <p className="mt-1.5 text-sm text-destructive">
                {form.formState.errors.doelgroep.message}
              </p>
            )}
          </div>

          <FormField
            control={form.control}
            name="doel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Doelstelling</FormLabel>
                <FormControl>
                  <Input placeholder="Wat leren de deelnemers?" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="beginsituatie"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Beginsituatie (optioneel)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Opstelling, groepsindeling..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="beschrijving"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Beschrijving & opbouw</FormLabel>
                <FormControl>
                  <Textarea
                    className="min-h-32"
                    placeholder="Leg de activiteit stap voor stap uit — dit is waar de kwaliteitscheck vooral op let."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="veld"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Veld / ruimte (optioneel)</FormLabel>
                <FormControl>
                  <Input placeholder="Bijv. halve gymzaal, buiten op het veld" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DynamicTextList
            label="Benodigd materiaal"
            placeholder="Bijv. pionnen"
            items={form.watch("materiaal")}
            onChange={(items) => form.setValue("materiaal", items)}
          />

          <DynamicTextList
            label="Regels"
            placeholder="Voeg een regel toe"
            items={form.watch("regels")}
            onChange={(items) => form.setValue("regels", items)}
          />

          <DynamicTextList
            label="Loopt het? (differentiatie makkelijker/moeilijker)"
            placeholder="Voeg een tip toe"
            items={form.watch("loopt")}
            onChange={(items) => form.setValue("loopt", items)}
          />

          <DynamicTextList
            label="Lukt het? (technische aandachtspunten)"
            placeholder="Voeg een tip toe"
            items={form.watch("lukt")}
            onChange={(items) => form.setValue("lukt", items)}
          />

          <DynamicTextList
            label="Leeft het? (spelbeleving)"
            placeholder="Voeg een tip toe"
            items={form.watch("leeft")}
            onChange={(items) => form.setValue("leeft", items)}
          />

          <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
            {form.formState.isSubmitting ? "Bezig met controleren..." : "Activiteit indienen"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
