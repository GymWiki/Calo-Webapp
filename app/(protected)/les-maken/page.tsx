import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { LessonForm } from "./lesson-form";

export default async function LesMakenPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Les maken</h1>
        <p className="text-sm text-muted-foreground">
          Bouw je activiteitvoorbereiding stap voor stap op.
        </p>
      </div>
      <LessonForm
        role={profile.role}
        authorName={`${profile.first_name} ${profile.last_name}`.trim()}
      />
    </main>
  );
}
