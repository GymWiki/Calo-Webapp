import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { ActivityEditor, type EditableActivity } from "@/components/beheer/ActivityEditor";
import { PageHeader } from "@/components/page-header";
import { requireAdminPage } from "@/lib/auth/admin";
import { EDIT_COLUMNS, getActivityAudit, getFloorplansForAdmin } from "@/lib/services/adminActivities";
import { createClient } from "@/utils/supabase/server";

export const metadata = { title: "Activiteit bewerken — Beheer", robots: { index: false, follow: false } };

export default async function BeheerActivityPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const supabase = createClient(await cookies());

  const { data } = await supabase.from("activiteiten").select(EDIT_COLUMNS).eq("id", id).maybeSingle();
  if (!data) notFound();
  const activity = data as unknown as EditableActivity;

  const [audit, floorplans, author] = await Promise.all([
    getActivityAudit(supabase, id),
    getFloorplansForAdmin(supabase, id, activity.author_id),
    activity.author_id ? supabase.from("users").select("first_name, last_name").eq("id", activity.author_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const authorName = author.data ? `${author.data.first_name} ${author.data.last_name}`.trim() : null;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader eyebrow="Beheer" title={activity.titel} description="Pas alle velden aan. Wijzigingen worden vastgelegd in het auditlog en zijn per veld terug te zetten." />
      <ActivityEditor activity={activity} audit={audit} floorplans={floorplans} authorName={authorName} />
    </main>
  );
}
