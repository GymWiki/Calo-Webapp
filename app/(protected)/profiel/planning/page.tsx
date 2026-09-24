import { redirect } from "next/navigation";
import { CalendarRange } from "lucide-react";

import { AddClassButton } from "@/components/planning/AddClassButton";
import { ClassCard } from "@/components/planning/ClassCard";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getClassesForUser } from "@/lib/services/planning";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function ProfielPlanningPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const classes = await getClassesForUser(profile.id);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-6xl">
      <PageHeader
        eyebrow="Profiel"
        title="Planning"
        description="Klassen, jaarplanning per leerlijn en weekplanning per les."
        action={<AddClassButton />}
      />

      {classes.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Nog geen klassen"
          description="Maak een klas aan met vaste weekmomenten om te beginnen met plannen."
          action={<AddClassButton />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((klas) => (
            <ClassCard key={klas.id} klas={klas} />
          ))}
        </div>
      )}
    </main>
  );
}
