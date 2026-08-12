import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ActivityDetailActions } from "@/components/activity-detail-actions";
import { ActivityImageLightbox } from "@/components/activity-image-lightbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUserPermissions } from "@/lib/permissions";
import { getActivityById, isActivitySaved } from "@/lib/services/activities";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { DOELGROEP_LABELS } from "@/types/activity";

// Zelfde blauw/groen/rood-indeling als de Leerhulp-tab op de lesvoorbereiding-
// detailpagina (app/(protected)/les/[id]/page.tsx) — merkkleur per L, niet
// per willekeurige volgorde.
const LEERHULP_COLORS = {
  loopt: { border: "border-blue-200", header: "bg-blue-50 text-blue-900" },
  lukt: { border: "border-green-200", header: "bg-green-50 text-green-900" },
  leeft: { border: "border-red-200", header: "bg-red-50 text-red-900" },
} as const;

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

function NumberedList({ items }: { items: string[] | null }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ol>
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

function LeerhulpCard({
  title,
  tips,
  colors,
}: {
  title: string;
  tips: string[] | null;
  colors: { border: string; header: string };
}) {
  return (
    <Card className={colors.border}>
      <CardHeader className={`rounded-t-xl ${colors.header}`}>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
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
  const { isPro } = getUserPermissions(profile);

  const doelgroepLabels = (activity.doelgroep ?? [])
    .map((waarde) => DOELGROEP_LABELS[waarde])
    .filter((label): label is string => Boolean(label));
  const groepNiveauSummary = [
    activity.niveau !== null ? `Niveau ${activity.niveau}` : null,
    doelgroepLabels.length > 0 ? doelgroepLabels.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
          <ActivityDetailActions activity={activity} initiallySaved={saved} isPro={isPro} xp={profile.xp} />
        </div>
      </div>

      {/* Header — vast bovenaan */}
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

      {/* Arrangement / plattegrond — vast bovenaan, boven de tab-balk */}
      <Card className="animate-fade-up" style={{ animationDelay: "40ms" }}>
        <CardHeader>
          <CardTitle>Arrangement</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityImageLightbox src={activity.afbeelding} alt={activity.titel} />
        </CardContent>
      </Card>

      <Tabs defaultValue="lesinhoud" className="animate-fade-up" style={{ animationDelay: "80ms" }}>
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
          <TabsTrigger value="lesinhoud">Lesinhoud & Regels</TabsTrigger>
          <TabsTrigger value="veld">Veld & Materiaal</TabsTrigger>
          <TabsTrigger value="leerhulp">Leerhulp</TabsTrigger>
        </TabsList>

        {/* Tab 1: Lesinhoud & Regels */}
        <TabsContent value="lesinhoud" className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <h3 className="mb-1 text-sm font-medium">Beginsituatie & Doelgroep</h3>
                {groepNiveauSummary && (
                  <p className="text-sm text-muted-foreground">{groepNiveauSummary}</p>
                )}
                <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
                  {activity.beginsituatie || "-"}
                </p>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-medium">Doelstelling</h3>
                <p className="text-sm text-muted-foreground">{activity.doel || "-"}</p>
              </div>
              {activity.learning_outcomes && activity.learning_outcomes.length > 0 && (
                <div>
                  <h3 className="mb-1 text-sm font-medium">Leermogelijkheden / Leeruitkomsten</h3>
                  <NumberedList items={activity.learning_outcomes} />
                </div>
              )}
              <div>
                <h3 className="mb-1 text-sm font-medium">Beschrijving</h3>
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  {activity.beschrijving || "-"}
                </p>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium">Regels</h3>
                <TextList items={activity.regels} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Veld & Materiaal */}
        <TabsContent value="veld" className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <h3 className="mb-1 text-sm font-medium">Veldafmetingen & Opstelling</h3>
                <p className="text-sm text-muted-foreground">{activity.veld || "-"}</p>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium">Materiaallijst</h3>
                <BadgeList items={activity.materiaal} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Leerhulp (3 L'en) */}
        <TabsContent value="leerhulp" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <LeerhulpCard title="Loopt het?" tips={activity.loopt} colors={LEERHULP_COLORS.loopt} />
            <LeerhulpCard title="Lukt het?" tips={activity.lukt} colors={LEERHULP_COLORS.lukt} />
            <LeerhulpCard title="Leeft het?" tips={activity.leeft} colors={LEERHULP_COLORS.leeft} />
          </div>
        </TabsContent>
      </Tabs>

      <div className="md:hidden">
        <ActivityDetailActions activity={activity} initiallySaved={saved} isPro={isPro} xp={profile.xp} />
      </div>
    </main>
  );
}
