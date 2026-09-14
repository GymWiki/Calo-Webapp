import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { checkLessonGeneratorAccess } from "@/lib/ai/lessonGeneratorAccess";
import { getAvailableSourceCount } from "@/lib/services/knowledgePackages";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { getActivityById } from "@/lib/services/activities";
import { createClient } from "@/utils/supabase/server";
import type { Activity } from "@/types/activity";
import {
  EMPTY_GAME_DIMENSIONS,
  type CreateLessonFormInput,
  type DidacticItem,
} from "@/types/lesson";
import { LesMakenFlow } from "./lesson-flow";

// Ruimere functie-timeout voor de server-acties die deze pagina aanroept —
// met name processActivityImportJob (actions/activityImport.ts), dat
// tekstextractie + AI-mapping synchroon uitvoert. De default is voor de
// meeste documenten ruim genoeg, maar een grotere/tragere AI-respons mag
// niet halverwege worden afgekapt.
export const maxDuration = 60;

// "Kopieer & bewerk" pre-fill (activiteiten-bibliotheek -> les-maken). Only
// the fields with a reasonable source on `activiteiten` are mapped —
// movementProblem/lessonDate/groupName have no equivalent and are left
// blank for the user to fill in. See
// docs/superpowers/specs/2026-08-11-activiteiten-bibliotheek-design.md
function mapActivityToLessonInput(
  activity: Activity,
): Partial<CreateLessonFormInput> {
  const aandachtspunten = [
    activity.loopt?.length ? `Loopt het?\n${activity.loopt.map((t) => `- ${t}`).join("\n")}` : null,
    activity.lukt?.length ? `Lukt het?\n${activity.lukt.map((t) => `- ${t}`).join("\n")}` : null,
    activity.leeft?.length ? `Leeft het?\n${activity.leeft.map((t) => `- ${t}`).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    title: activity.titel,
    learningLine: activity.leerlijn ?? "",
    movementTheme: activity.beweegthema ?? "",
    goals: activity.doel ?? "",
    baseMaterials: activity.materiaal ?? [],
    rules: activity.regels ?? [],
    arrangement: activity.beschrijving ?? "",
    deelnemersRegels: (activity.regels ?? []).join("\n"),
    plaatjePraatje: activity.beginsituatie ?? "",
    aandachtspunten,
  };
}

// Hervat een eigen, nog niet ingediend wizard-concept (zie
// actions/lesson.ts's saveLessonDraft) — het omgekeerde van hoe createLesson
// een CreateLessonInput naar de `activiteiten`-rij vertaalt. Alleen relevant
// voor `?vanuit=` waar dat concept vandaan komt (zie
// own-activities-section.tsx), nooit voor de "Kopieer & bewerk"-link vanaf
// de bibliotheek (die wijst altijd naar een eenvoudige activiteit).
function mapWizardActivityToLessonInput(activity: Activity): Partial<CreateLessonFormInput> {
  return {
    title: activity.titel,
    lessonDate: activity.activity_date ?? "",
    groupName: activity.group_name ?? "",
    learningLine: activity.leerlijn ?? "",
    doelgroep: activity.doelgroep ?? [],
    movementProblem: activity.movement_problem ?? "",
    movementTheme: activity.beweegthema ?? "",
    baseMaterials: activity.base_materials ?? [],
    ruleMaterials: activity.rule_materials ?? [],
    minParticipants: activity.min_participants ?? undefined,
    participantsBench: activity.participants_bench ?? undefined,
    rules: activity.regels ?? [],
    goals: activity.doel ?? "",
    learningOutcomes: activity.learning_outcomes ?? [],
    didacticItems: (activity.didactic_items ?? []) as DidacticItem[],
    gameCategory: activity.game_category ?? "",
    gameDimensions: activity.game_dimensions ?? EMPTY_GAME_DIMENSIONS,
    tacticalQuestions: activity.tactical_questions ?? [],
    arrangement: activity.arrangement ?? "",
    deelnemersRegels: activity.deelnemers_regels ?? "",
    plaatjePraatje: activity.plaatje_praatje ?? "",
    aandachtspunten: activity.aandachtspunten ?? "",
  };
}

const TAB_VALUES = ["context", "organisatie", "didactiek", "voorbereiding"] as const;

function parseInitialTab(value: string | undefined) {
  return (TAB_VALUES as readonly string[]).includes(value ?? "")
    ? (value as (typeof TAB_VALUES)[number])
    : undefined;
}

export default async function LesMakenPage({
  searchParams,
}: {
  searchParams: Promise<{ vanuit?: string; tab?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const { vanuit, tab } = await searchParams;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const [activity, activeSourceCount, lessonGeneratorAccess] = await Promise.all([
    vanuit ? getActivityById(vanuit) : Promise.resolve(null),
    getAvailableSourceCount(profile.id),
    checkLessonGeneratorAccess(supabase, profile.id, profile.subscription_status),
  ]);
  const initialTab = parseInitialTab(tab);
  const skipChoice = Boolean(activity) || Boolean(initialTab);

  // Een eigen, nog niet ingediend wizard-concept hervatten (link vanuit
  // "Mijn activiteiten", zie own-activities-section.tsx) is iets anders dan
  // de bestaande "Kopieer & bewerk"-prefill vanaf de bibliotheek: dat
  // laatste kopieert een bestaande, andere activiteit naar een NIEUWE rij;
  // dit werkt dezelfde rij verder bij.
  const resumingOwnDraft =
    activity !== null &&
    activity.arrangement !== null &&
    activity.author_id === profile.id &&
    activity.status === "draft";

  const initialValues = activity
    ? resumingOwnDraft
      ? mapWizardActivityToLessonInput(activity)
      : mapActivityToLessonInput(activity)
    : undefined;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-5xl xl:max-w-6xl">
      <PageHeader
        eyebrow="Activiteit maken"
        title="Nieuwe activiteit"
        description={
          resumingOwnDraft
            ? `Concept "${activity.titel}" — ga verder waar je gebleven was.`
            : activity
              ? `Gebaseerd op "${activity.titel}" — vul de ontbrekende velden aan.`
              : skipChoice
                ? "Bouw je activiteit stap voor stap op."
                : "Kies hoe je wilt beginnen."
        }
      />
      <LesMakenFlow
        authorName={`${profile.first_name} ${profile.last_name}`.trim()}
        initialValues={initialValues}
        initialActivityId={resumingOwnDraft ? activity.id : undefined}
        initialTab={initialTab}
        activeSourceCount={activeSourceCount}
        lessonGeneratorAccess={lessonGeneratorAccess}
        skipChoice={skipChoice}
      />
    </main>
  );
}
