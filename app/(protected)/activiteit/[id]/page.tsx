import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ActivityDetailActions } from "@/components/activity-detail-actions";
import { ActivityImageLightbox } from "@/components/activity-image-lightbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActivityById, isActivitySaved } from "@/lib/services/activities";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { DOELGROEP_LABELS } from "@/types/activity";

function TextList({ items }: { items: string[] | null }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground">-</p>;
  }

  return (
    <ul className="space-y-1 text-sm">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>• {item}</li>
      ))}
    </ul>
  );
}

function BadgeList({ items }: { items: string[] | null }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground">-</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <Badge key={`${item}-${index}`} variant="secondary">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function TipCard({ title, tips }: { title: string; tips: string[] | null }) {
  return (
    <Card className="bg-muted/40">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <TextList items={tips} />
      </CardContent>
    </Card>
  );
}

export default async function ActiviteitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const activity = await getActivityById(id);

  if (!activity) {
    notFound();
  }

  const saved = await isActivitySaved(profile.id, activity.id);

  const doelgroepLabels = (activity.doelgroep ?? [])
    .map((waarde) => DOELGROEP_LABELS[waarde])
    .filter((label): label is string => Boolean(label));

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 pb-28 md:p-8 md:pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link href="/zoeken">
            <ArrowLeft className="size-4" />
            Terug naar Activiteiten
          </Link>
        </Button>
        <div className="hidden md:block">
          <ActivityDetailActions activityId={activity.id} initiallySaved={saved} isPro={profile.is_pro} xp={profile.xp} />
        </div>
      </div>

      {/* Header */}
      <Card className="animate-fade-up">
        <CardHeader>
          <p className="font-mono text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            {activity.categorie ?? "Activiteit"}
          </p>
          <CardTitle className="mt-1 text-2xl">{activity.titel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {activity.leerlijn && <Badge variant="secondary">{activity.leerlijn}</Badge>}
            {activity.beweegthema && (
              <Badge variant="outline">{activity.beweegthema}</Badge>
            )}
            {activity.niveau && <Badge variant="outline">Niveau {activity.niveau}</Badge>}
            {doelgroepLabels.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Arrangement / plattegrond */}
      <Card className="animate-fade-up" style={{ animationDelay: "40ms" }}>
        <CardHeader>
          <CardTitle>Arrangement</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityImageLightbox src={activity.afbeelding} alt={activity.titel} />
        </CardContent>
      </Card>

      {/* Sectie 1: Context & Materialen */}
      <Card className="animate-fade-up" style={{ animationDelay: "80ms" }}>
        <CardHeader>
          <CardTitle>Context & Materialen</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium">Basismateriaal</h3>
            <BadgeList items={activity.materiaal} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Veld</h3>
            <p className="text-sm text-muted-foreground">{activity.veld ?? "-"}</p>
          </div>
          <div className="sm:col-span-2">
            <h3 className="mb-2 text-sm font-medium">Regels</h3>
            <TextList items={activity.regels} />
          </div>
        </CardContent>
      </Card>

      {/* Sectie 2: Didactische analyse */}
      <Card className="animate-fade-up" style={{ animationDelay: "120ms" }}>
        <CardHeader>
          <CardTitle>Didactische analyse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activity.doel && (
            <div>
              <h3 className="mb-1 text-sm font-medium">Doel</h3>
              <p className="text-sm text-muted-foreground">{activity.doel}</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <TipCard title="Loopt het?" tips={activity.loopt} />
            <TipCard title="Lukt het?" tips={activity.lukt} />
            <TipCard title="Leeft het?" tips={activity.leeft} />
          </div>
        </CardContent>
      </Card>

      {/* Sectie 3: Beginsituatie & Beschrijving */}
      <Card className="animate-fade-up" style={{ animationDelay: "160ms" }}>
        <CardHeader>
          <CardTitle>Beginsituatie & Beschrijving</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Card className="bg-muted/40">
            <CardHeader>
              <CardTitle className="text-base">Beginsituatie</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-line text-muted-foreground">
                {activity.beginsituatie || "-"}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-muted/40">
            <CardHeader>
              <CardTitle className="text-base">Beschrijving</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-line text-muted-foreground">
                {activity.beschrijving || "-"}
              </p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <div className="md:hidden">
        <ActivityDetailActions activityId={activity.id} initiallySaved={saved} isPro={profile.is_pro} xp={profile.xp} />
      </div>
    </main>
  );
}
