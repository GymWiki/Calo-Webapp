import { redirect } from "next/navigation";

// "Lessen" en "activiteiten" zijn samengevoegd tot één concept (zie
// supabase/migrations/consolidate_lessons_into_activiteiten.sql) — deze
// route blijft bestaan zodat oude links niet breken, maar wijst nu door
// naar de unified detailpagina.
export default async function LesDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/activiteit/${id}`);
}
