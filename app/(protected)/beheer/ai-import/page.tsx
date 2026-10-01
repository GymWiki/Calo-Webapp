import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isLibraryAdmin } from "@/lib/adminAccess";
import { getCompletedImportJobCount, getImportFeedbackSummary } from "@/lib/services/importFeedback";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

/**
 * Intern, admin-only overzicht van de feedbacklus voor "Activiteit uit
 * document" (zie de brief "Herbouw de activiteit-import", Deel 5): welke
 * velden gebruikers ná een import het vaakst bewerken of met een "Niet
 * geplaatst"-item aanvullen. Een hoog aantal bij een veld wijst op een
 * structureel extractieprobleem — bruikbaar om het brondocument aan
 * fixtures/imports toe te voegen als regressietest. Gegated op
 * isLibraryAdmin, zelfde patroon als /beheer/taalcheck.
 */
export default async function AiImportBeheerPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!isLibraryAdmin(profile.email)) {
    redirect("/dashboard");
  }

  const [summary, completedJobCount] = await Promise.all([
    getImportFeedbackSummary(),
    getCompletedImportJobCount(),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-5xl">
      <PageHeader
        eyebrow="Beheer · AI-import"
        title="Feedback op documentimport"
        description={`Welke velden gebruikers ná "Activiteit uit document" het vaakst zelf nog aanpassen — zonder tekstinhoud, puur telwerk. Gebaseerd op ${completedJobCount} voltooide ${completedJobCount === 1 ? "import" : "imports"}.`}
      />

      {summary.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nog geen feedback gelogd — zodra gebruikers een geïmporteerde activiteit opslaan, verschijnen
            hier de meest aangepaste velden.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meest aangepaste velden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.map((entry) => (
              <div
                key={entry.fieldName}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <span className="font-mono text-sm">{entry.fieldName}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{entry.totalCount} totaal</Badge>
                  {entry.editedCount > 0 && <Badge variant="outline">{entry.editedCount}× bewerkt</Badge>}
                  {entry.movedFromUnplacedCount > 0 && (
                    <Badge variant="outline">
                      {entry.movedFromUnplacedCount}× vanuit &quot;Niet geplaatst&quot;
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
