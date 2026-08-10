import { redirect } from "next/navigation";
import { LessonCard } from "@/components/lesson-card";
import { getUserLessons } from "@/lib/services/lessons";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function StudentDashboardPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const lessons = await getUserLessons(profile.id);

  return (
    <main className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">
        Welkom Student, hier komt je stage-overzicht.
      </h1>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Jouw lessen</h2>
        {lessons.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Je hebt nog geen lessen gemaakt. Ga naar &quot;Les maken&quot; om
            te beginnen.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
