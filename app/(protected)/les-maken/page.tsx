import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { getActivityById } from "@/lib/services/activities";
import type { Activity } from "@/types/activity";
import type { CreateLessonFormInput } from "@/types/lesson";
import { LessonForm } from "./lesson-form";

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

export default async function LesMakenPage({
  searchParams,
}: {
  searchParams: Promise<{ vanuit?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const { vanuit } = await searchParams;
  const activity = vanuit ? await getActivityById(vanuit) : null;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Les maken"
        title="Nieuwe lesvoorbereiding"
        description={
          activity
            ? `Gebaseerd op "${activity.titel}" — vul de ontbrekende velden aan.`
            : "Bouw je activiteitvoorbereiding stap voor stap op."
        }
      />
      <LessonForm
        role={profile.role}
        authorName={`${profile.first_name} ${profile.last_name}`.trim()}
        initialValues={activity ? mapActivityToLessonInput(activity) : undefined}
      />
    </main>
  );
}
