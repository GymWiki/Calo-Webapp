import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GameDimensions } from "@/types/lesson";

const DIMENSION_LABELS: Record<keyof GameDimensions, string> = {
  space: "Ruimte (Space)",
  equipment: "Materiaal (Equipment)",
  people: "Aantallen (People)",
  rules: "Regels (Rules)",
};

/** Read-only Game-Based Pedagogy summary for the lesson detail page + PDF. */
export function GameBasedPedagogyMatrix({
  category,
  dimensions,
  tacticalQuestions,
}: {
  category: string | null;
  dimensions: GameDimensions | null;
  tacticalQuestions: string[] | null;
}) {
  const hasDimensions =
    dimensions &&
    Object.values(dimensions).some((value) => value && value.trim().length > 0);
  const questions = tacticalQuestions ?? [];

  if (!category && !hasDimensions && questions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Game-Based Pedagogy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {category && (
          <div>
            <h3 className="mb-1.5 text-sm font-medium">Spelcategorie</h3>
            <Badge variant="secondary">{category}</Badge>
          </div>
        )}

        {hasDimensions && (
          <div>
            <h3 className="mb-2 text-sm font-medium">Speldimensies</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(DIMENSION_LABELS) as (keyof GameDimensions)[]).map(
                (key) => (
                  <div key={key} className="rounded-lg border p-2.5">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {DIMENSION_LABELS[key]}
                    </p>
                    <p className="mt-0.5 text-sm">{dimensions?.[key] || "-"}</p>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {questions.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-sm font-medium">
              Tactische reflectievragen
            </h3>
            <ul className="space-y-1 text-sm">
              {questions.map((question, index) => (
                <li key={`${question}-${index}`}>• {question}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
