import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { LessonForm } from "./lesson-form";

export default async function LesMakenPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Les maken"
        title="Nieuwe lesvoorbereiding"
        description="Bouw je activiteitvoorbereiding stap voor stap op."
      />
      <LessonForm
        role={profile.role}
        authorName={`${profile.first_name} ${profile.last_name}`.trim()}
      />
    </main>
  );
}
