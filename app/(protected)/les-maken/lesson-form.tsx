"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { createLesson } from "@/actions/lesson";
import { DidacticsForm } from "@/components/DidacticsForm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ANDERS_OPTION,
  BASISDOCUMENT_BEWEGINGSPROBLEMEN,
  BASISDOCUMENT_LEERLIJNEN,
  createLessonDefaultValues,
  createLessonInputSchema,
  type BasisdocumentLeerlijn,
  type CreateLessonFormInput,
  type CreateLessonInput,
  type DidacticItem,
} from "@/types/lesson";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { DiagramData } from "@/components/canvas/gym-canvas-types";
import { DiagramEditorCard } from "./diagram-editor-card";
import { DynamicTextList } from "./dynamic-text-list";

const TAB_ORDER = ["context", "organisatie", "didactiek", "voorbereiding"] as const;
type TabValue = (typeof TAB_ORDER)[number];

const TAB_LABELS: Record<TabValue, string> = {
  context: "Context & Thema",
  organisatie: "Organisatie",
  didactiek: "Didactiek",
  voorbereiding: "Voorbereiding",
};

function StepProgress({ activeTab }: { activeTab: TabValue }) {
  const activeIndex = TAB_ORDER.indexOf(activeTab);
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Stap {activeIndex + 1} van {TAB_ORDER.length}
        </p>
        <p className="text-xs font-medium text-primary">
          {TAB_LABELS[activeTab]}
        </p>
      </div>
      <div className="mt-2 flex gap-1.5">
        {TAB_ORDER.map((tab, index) => (
          <div
            key={tab}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300 ease-brand",
              index <= activeIndex ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
}

const SELECT_CLASS =
  "border-input flex h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

// Backs both the Leerlijn and Bewegingsprobleem fields: a dropdown of
// Basisdocument-standardized options, with an "Anders, namelijk..." escape
// hatch into free text for cases the curated list doesn't cover.
function BasisdocumentField({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<"select" | "custom">(
    value && !options.includes(value) ? "custom" : "select",
  );

  if (mode === "custom") {
    return (
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setMode("select");
            onChange("");
          }}
          disabled={disabled}
        >
          Kies uit lijst
        </Button>
      </div>
    );
  }

  return (
    <select
      value={options.includes(value) ? value : ""}
      onChange={(event) => {
        if (event.target.value === ANDERS_OPTION) {
          setMode("custom");
          onChange("");
        } else {
          onChange(event.target.value);
        }
      }}
      disabled={disabled}
      className={SELECT_CLASS}
    >
      <option value="" disabled>
        Kies een optie
      </option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
      <option value={ANDERS_OPTION}>{ANDERS_OPTION}</option>
    </select>
  );
}

export function LessonForm({
  role,
  authorName,
  initialValues,
  initialTab,
}: {
  role: UserRole;
  authorName: string;
  initialValues?: Partial<CreateLessonFormInput>;
  initialTab?: TabValue;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab ?? "context");
  const [baseMaterials, setBaseMaterials] = useState<string[]>(
    initialValues?.baseMaterials ?? [],
  );
  const [ruleMaterials, setRuleMaterials] = useState<string[]>(
    initialValues?.ruleMaterials ?? [],
  );
  const [rules, setRules] = useState<string[]>(initialValues?.rules ?? []);
  const [didacticItems, setDidacticItems] = useState<DidacticItem[]>(
    initialValues?.didacticItems ?? [],
  );
  const [diagram, setDiagram] = useState<{
    data: DiagramData;
    imageDataUrl: string;
  } | null>(null);

  const form = useForm<CreateLessonFormInput, unknown, CreateLessonInput>({
    resolver: zodResolver(createLessonInputSchema),
    defaultValues: { ...createLessonDefaultValues, ...initialValues },
  });
  const selectedLearningLine = useWatch({
    control: form.control,
    name: "learningLine",
  }) as BasisdocumentLeerlijn;

  function goRelative(offset: 1 | -1) {
    const index = TAB_ORDER.indexOf(activeTab);
    const next = TAB_ORDER[index + offset];
    if (next) setActiveTab(next);
  }

  async function onSubmit(values: CreateLessonInput) {
    const payload: CreateLessonInput = {
      ...values,
      baseMaterials,
      ruleMaterials,
      rules,
      didacticItems,
    };

    const result = await createLesson(payload, diagram);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Les opgeslagen!");
    router.push(role === "docent" ? "/docent/dashboard" : "/student/dashboard");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <StepProgress activeTab={activeTab} />
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="context">Context & Thema</TabsTrigger>
            <TabsTrigger value="organisatie">Organisatie</TabsTrigger>
            <TabsTrigger value="didactiek">Didactiek</TabsTrigger>
            <TabsTrigger value="voorbereiding">Voorbereiding</TabsTrigger>
          </TabsList>

          {/* Tab 1 — Context & Thema */}
          <TabsContent value="context" className="animate-fade-up">
            <Card>
              <CardHeader>
                <CardTitle>Context & Thema</CardTitle>
                <CardDescription>
                  De basisgegevens van je activiteit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titel van activiteit</FormLabel>
                      <FormControl>
                        <Input placeholder="Bijv. Keeperspelen" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Studentnaam/Auteur</Label>
                    <Input value={authorName} disabled readOnly />
                  </div>
                  <FormField
                    control={form.control}
                    name="lessonDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Datum</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="groupName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Groep/klas</FormLabel>
                      <FormControl>
                        <Input placeholder="Bijv. Groep 7/8 of Klas 1B" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="learningLine"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leerlijn (Basisdocument Bewegingsonderwijs)</FormLabel>
                      <FormControl>
                        <BasisdocumentField
                          value={field.value}
                          onChange={(value) => {
                            field.onChange(value);
                            form.setValue("movementProblem", "");
                          }}
                          options={BASISDOCUMENT_LEERLIJNEN}
                          placeholder="Bijv. Doelspelen"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="movementProblem"
                  render={({ field }) => {
                    const options =
                      BASISDOCUMENT_BEWEGINGSPROBLEMEN[selectedLearningLine] ?? [];
                    return (
                      <FormItem>
                        <FormLabel>Bewegingsprobleem</FormLabel>
                        <FormControl>
                          <BasisdocumentField
                            key={selectedLearningLine}
                            value={field.value}
                            onChange={field.onChange}
                            options={options}
                            placeholder="Bijv. Keeper verdedigen"
                            disabled={options.length === 0}
                          />
                        </FormControl>
                        {options.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            Kies eerst een leerlijn voor gestandaardiseerde opties.
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="movementTheme"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bewegingsthema</FormLabel>
                      <FormControl>
                        <Input placeholder="Bijv. Keeperspelen" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={() => goRelative(1)}>
                Volgende
              </Button>
            </div>
          </TabsContent>

          {/* Tab 2 — Organisatie & Materialen */}
          <TabsContent value="organisatie" className="animate-fade-up">
            <Card>
              <CardHeader>
                <CardTitle>Organisatie & Materialen</CardTitle>
                <CardDescription>
                  Wat heb je nodig en hoeveel deelnemers doen mee?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <DynamicTextList
                  label="Basismateriaal"
                  placeholder="Bijv. 6 kleine matjes"
                  items={baseMaterials}
                  onChange={setBaseMaterials}
                />
                <DynamicTextList
                  label="Regelmateriaal"
                  placeholder="Bijv. 4 foamballen"
                  items={ruleMaterials}
                  onChange={setRuleMaterials}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="minParticipants"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deelnemers in het veld</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            {...field}
                            value={(field.value as number | undefined) ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="participantsBench"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deelnemers op de bank</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            {...field}
                            value={(field.value as number | undefined) ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DynamicTextList
                  label="Regels"
                  placeholder="Bijv. Geen slingerworpen"
                  items={rules}
                  onChange={setRules}
                />
              </CardContent>
            </Card>
            <div className="mt-4 flex justify-between">
              <Button type="button" variant="outline" onClick={() => goRelative(-1)}>
                Vorige
              </Button>
              <Button type="button" onClick={() => goRelative(1)}>
                Volgende
              </Button>
            </div>
          </TabsContent>

          {/* Tab 3 — Didactische analyse (de 3 L'en, Walinga & Koekoek 2021) */}
          <TabsContent value="didactiek" className="animate-fade-up space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Didactische analyse</CardTitle>
                <CardDescription>Doelen en de 3 L&apos;en.</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="goals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Doelen (motorisch en sociaal)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Bijv. Iedereen speelt eerlijk"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <DidacticsForm items={didacticItems} onChange={setDidacticItems} />

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => goRelative(-1)}>
                Vorige
              </Button>
              <Button type="button" onClick={() => goRelative(1)}>
                Volgende
              </Button>
            </div>
          </TabsContent>

          {/* Tab 4 — Activiteitsvoorbereiding (de 4 kernelementen) */}
          <TabsContent value="voorbereiding" className="animate-fade-up">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Arrangement</CardTitle>
                  <CardDescription>
                    De fysieke opstelling en het speelveld.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="arrangement"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea className="min-h-32" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Deelnemers & Regels</CardTitle>
                  <CardDescription>
                    Rolinvulling: wie staat waar, wisselregels, scheidsrechters
                    op de bank.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="deelnemersRegels"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea className="min-h-32" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Plaatje & Praatje</CardTitle>
                  <CardDescription>
                    Hoe de instructie visueel getoond wordt, hoe doelen worden
                    uitgelegd en de wisselafspraken.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="plaatjePraatje"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea className="min-h-32" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Aandachtspunten</CardTitle>
                  <CardDescription>
                    Veiligheid, houding en tactiek.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="aandachtspunten"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea className="min-h-32" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
            <div className="mt-4">
              <DiagramEditorCard
                onExport={(data, imageDataUrl) => setDiagram({ data, imageDataUrl })}
              />
            </div>
            <div className="mt-4 flex justify-between">
              <Button type="button" variant="outline" onClick={() => goRelative(-1)}>
                Vorige
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Bezig met opslaan..." : "Les opslaan"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </form>
    </Form>
  );
}
