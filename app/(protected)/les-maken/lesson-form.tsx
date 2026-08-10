"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createLesson } from "@/actions/lesson";
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
  createLessonDefaultValues,
  createLessonInputSchema,
  type CreateLessonFormInput,
  type CreateLessonInput,
} from "@/types/lesson";
import type { UserRole } from "@/lib/types";
import type { DiagramData } from "@/components/canvas/gym-canvas-types";
import { DiagramEditorCard } from "./diagram-editor-card";
import { DynamicTextList } from "./dynamic-text-list";

const TAB_ORDER = ["context", "organisatie", "didactiek", "voorbereiding"] as const;
type TabValue = (typeof TAB_ORDER)[number];

type LFieldName =
  | "luktHetZwakSee"
  | "luktHetZwakDo"
  | "looptHetSee"
  | "looptHetDo"
  | "leeftHetSee"
  | "leeftHetDo"
  | "luktHetGoedSee"
  | "luktHetGoedDo";

const L_QUESTIONS: {
  title: string;
  seeField: LFieldName;
  doField: LFieldName;
}[] = [
  {
    title: "Lukt het? (Zwakkere beweger)",
    seeField: "luktHetZwakSee",
    doField: "luktHetZwakDo",
  },
  {
    title: "Loopt het? (Organisatie & Flow)",
    seeField: "looptHetSee",
    doField: "looptHetDo",
  },
  {
    title: "Leeft het? (Beleving & Plezier)",
    seeField: "leeftHetSee",
    doField: "leeftHetDo",
  },
  {
    title: "Lukt het? (Betere beweger)",
    seeField: "luktHetGoedSee",
    doField: "luktHetGoedDo",
  },
];

export function LessonForm({
  role,
  authorName,
}: {
  role: UserRole;
  authorName: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabValue>("context");
  const [baseMaterials, setBaseMaterials] = useState<string[]>([]);
  const [ruleMaterials, setRuleMaterials] = useState<string[]>([]);
  const [rules, setRules] = useState<string[]>([]);
  const [diagram, setDiagram] = useState<{
    data: DiagramData;
    imageDataUrl: string;
  } | null>(null);

  const form = useForm<CreateLessonFormInput, unknown, CreateLessonInput>({
    resolver: zodResolver(createLessonInputSchema),
    defaultValues: createLessonDefaultValues,
  });

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
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="context">Context & Thema</TabsTrigger>
            <TabsTrigger value="organisatie">Organisatie</TabsTrigger>
            <TabsTrigger value="didactiek">Didactiek</TabsTrigger>
            <TabsTrigger value="voorbereiding">Voorbereiding</TabsTrigger>
          </TabsList>

          {/* Tab 1 — Context & Thema */}
          <TabsContent value="context">
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
                      <FormLabel>Leerlijn</FormLabel>
                      <FormControl>
                        <Input placeholder="Bijv. Doelspelen" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="movementProblem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bewegingsprobleem</FormLabel>
                      <FormControl>
                        <Input placeholder="Bijv. Keeper verdedigen" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
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
          <TabsContent value="organisatie">
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

          {/* Tab 3 — Didactische analyse (de 4 L'en) */}
          <TabsContent value="didactiek">
            <Card>
              <CardHeader>
                <CardTitle>Didactische analyse</CardTitle>
                <CardDescription>Doelen en de 4 L&apos;en.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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
                <div className="grid gap-4 sm:grid-cols-2">
                  {L_QUESTIONS.map((question) => (
                    <Card key={question.title}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {question.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <FormField
                          control={form.control}
                          name={question.seeField}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Wat zie je?</FormLabel>
                              <FormControl>
                                <Textarea {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={question.doField}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Wat doe je?</FormLabel>
                              <FormControl>
                                <Textarea {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
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

          {/* Tab 4 — Activiteitsvoorbereiding (de 4 kernelementen) */}
          <TabsContent value="voorbereiding">
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
