"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createLesson } from "@/actions/lesson";
import { AiLescoachSheet } from "@/components/AiLescoachSheet";
import { DidacticsForm } from "@/components/DidacticsForm";
import { showLevelUpToast } from "@/components/gamification/level-up-toast";
import { KnowledgeSourceHint } from "@/components/KnowledgeSourceHint";
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
  AI_GENERATED_LESSON_STORAGE_KEY,
  type GeneratedLessonWithIds,
} from "@/types/ai";
import {
  EMPTY_GAME_DIMENSIONS,
  GAME_CATEGORIES,
  createLessonDefaultValues,
  createLessonInputSchema,
  type CreateLessonFormInput,
  type CreateLessonInput,
  type DidacticItem,
} from "@/types/lesson";
import { LEARNING_LINE_CATEGORIES } from "@/lib/constants/learningLines";
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

export function LessonForm({
  authorName,
  initialValues,
  initialTab,
  activeSourceCount,
}: {
  authorName: string;
  initialValues?: Partial<CreateLessonFormInput>;
  initialTab?: TabValue;
  activeSourceCount?: number;
}) {
  const router = useRouter();

  // Picks up a lesson stashed by the AI Activiteiten Generator wizard
  // (written to sessionStorage by AiLessonWizard before LesMakenFlow
  // switches to this component). Read once, synchronously, as part of the
  // initial render via lazy useState initializers below — not in an
  // effect — so there's no post-mount setState cascade; a fresh mount of
  // this component is the only time this matters, and every initializer
  // here runs once per mount regardless.
  const [stashedGenerated] = useState<GeneratedLessonWithIds | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(AI_GENERATED_LESSON_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(AI_GENERATED_LESSON_STORAGE_KEY);
    try {
      return JSON.parse(raw) as GeneratedLessonWithIds;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<TabValue>(initialTab ?? "context");
  const [baseMaterials, setBaseMaterials] = useState<string[]>(
    stashedGenerated?.baseMaterials ?? initialValues?.baseMaterials ?? [],
  );
  const [ruleMaterials, setRuleMaterials] = useState<string[]>(
    stashedGenerated?.ruleMaterials ?? initialValues?.ruleMaterials ?? [],
  );
  const [rules, setRules] = useState<string[]>(
    stashedGenerated?.rules ?? initialValues?.rules ?? [],
  );
  const [didacticItems, setDidacticItems] = useState<DidacticItem[]>(
    stashedGenerated?.didacticItems ?? initialValues?.didacticItems ?? [],
  );
  const [tacticalQuestions, setTacticalQuestions] = useState<string[]>(
    stashedGenerated?.tacticalQuestions ?? initialValues?.tacticalQuestions ?? [],
  );
  const [diagram, setDiagram] = useState<{
    data: DiagramData;
    imageDataUrl: string;
  } | null>(null);

  const form = useForm<CreateLessonFormInput, unknown, CreateLessonInput>({
    resolver: zodResolver(createLessonInputSchema),
    defaultValues: {
      ...createLessonDefaultValues,
      ...initialValues,
      ...(stashedGenerated
        ? {
            title: stashedGenerated.title,
            learningLine: stashedGenerated.learningLine,
            movementProblem: stashedGenerated.movementProblem,
            movementTheme: stashedGenerated.movementTheme,
            groupName: stashedGenerated.groupName || "",
            goals: stashedGenerated.goals,
            gameCategory: stashedGenerated.gameCategory || "",
            gameDimensions: {
              ...EMPTY_GAME_DIMENSIONS,
              ...stashedGenerated.gameDimensions,
            },
            arrangement: stashedGenerated.arrangement || "",
            deelnemersRegels: stashedGenerated.deelnemersRegels || "",
            plaatjePraatje: stashedGenerated.plaatjePraatje || "",
            aandachtspunten: stashedGenerated.aandachtspunten || "",
          }
        : {}),
    },
  });

  // Side-effect only (no setState) — safe in an effect. Fires once if a
  // generated lesson was picked up above.
  useEffect(() => {
    if (stashedGenerated) {
      toast.success("AI-gegenereerde lesvoorbereiding geladen — controleer en vul aan.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      tacticalQuestions,
    };

    const result = await createLesson(payload, diagram);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Les opgeslagen!");
    if (result.levelUp) {
      showLevelUpToast(result.levelUp);
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex flex-col items-end gap-1.5">
          <AiLescoachSheet
            getPayload={() => ({
              title: form.getValues("title"),
              learningLine: form.getValues("learningLine"),
              movementProblem: form.getValues("movementProblem"),
              movementTheme: form.getValues("movementTheme"),
              goals: form.getValues("goals"),
              didacticItems,
              gameCategory: form.getValues("gameCategory"),
              gameDimensions: form.getValues("gameDimensions"),
              tacticalQuestions,
            })}
            onApplyImprovement={(item) => setDidacticItems((prev) => [...prev, item])}
          />
          {activeSourceCount !== undefined && (
            <KnowledgeSourceHint count={activeSourceCount} />
          )}
        </div>
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
                      <FormLabel>Leerlijn</FormLabel>
                      <FormControl>
                        <select
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value)}
                          className={SELECT_CLASS}
                        >
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

            <Card>
              <CardHeader>
                <CardTitle>Game-Based Pedagogy</CardTitle>
                <CardDescription>
                  Koekoek, Dokman & Walinga — spelcategorie, speldimensies en
                  tactische reflectievragen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="gameCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Spelcategorie</FormLabel>
                      <FormControl>
                        <select
                          value={field.value}
                          onChange={(event) => field.onChange(event.target.value)}
                          className={SELECT_CLASS}
                        >
                          <option value="">Kies een spelcategorie</option>
                          {GAME_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <Label className="mb-2 block">
                    Speldimensies (Game Dimensions)
                  </Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="gameDimensions.space"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-normal text-muted-foreground">
                            Ruimte (Space)
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Bijv. Half veld, drie zones" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gameDimensions.equipment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-normal text-muted-foreground">
                            Materiaal (Equipment)
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Bijv. Grote, zachte bal" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gameDimensions.people"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-normal text-muted-foreground">
                            Aantallen (People)
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Bijv. 3 tegen 2" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gameDimensions.rules"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-normal text-muted-foreground">
                            Regels (Rules)
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Bijv. Alleen onderhands passen" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <DynamicTextList
                  label="Tactische reflectievragen (2-3 vragen)"
                  placeholder="Bijv. Wanneer kies je voor een korte in plaats van lange pass?"
                  items={tacticalQuestions}
                  onChange={setTacticalQuestions}
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
