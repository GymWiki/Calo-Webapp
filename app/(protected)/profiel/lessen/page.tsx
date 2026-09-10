import Link from "next/link";
import { redirect } from "next/navigation";
import { NotebookPen, SquarePen } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LessonCard } from "@/components/lesson-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getUserLessons } from "@/lib/services/lessons";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function ProfielLessenPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const lessons = await getUserLessons(profile.id);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Profiel"
        title="Mijn lessen"
        description="Al je lesvoorbereidingen uit de canvas-editor."
      />
      {lessons.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="Nog geen lessen gemaakt"
          description="Zodra je een lesvoorbereiding aanmaakt, verschijnt hij hier."
          action={
            <Button asChild>
              <Link href="/les-maken">
                <SquarePen className="size-4" />
                Eerste les maken
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} currentUserId={profile.id} />
          ))}
        </div>
      )}
    </main>
  );
}
