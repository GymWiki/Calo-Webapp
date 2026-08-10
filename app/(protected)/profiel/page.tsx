import { redirect } from "next/navigation";
import { Mail } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export default async function ProfielPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const initials = `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase();
  const roleLabel = profile.role === "docent" ? "Docent" : "Student";

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Profiel"
        title="Jouw account"
        description="Gegevens zoals ze bekend zijn bij GymBase."
      />

      <Card>
        <CardContent className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <div className="font-display flex size-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary">
            {initials}
          </div>
          <div className="space-y-2">
            <p className="text-xl font-bold">
              {profile.first_name} {profile.last_name}
            </p>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge>{roleLabel}</Badge>
              {profile.role === "student" && (
                <Badge variant={profile.available_for_internship ? "success" : "secondary"}>
                  {profile.available_for_internship
                    ? "Beschikbaar voor stage"
                    : "Niet beschikbaar voor stage"}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contactgegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>{profile.email ?? "Geen e-mailadres bekend"}</span>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
