import Link from "next/link";
import { cookies } from "next/headers";
import { CircleAlert } from "lucide-react";

import { AcceptInviteCard } from "@/components/team/AcceptInviteCard";
import { Card, CardContent } from "@/components/ui/card";
import { getTeamInvitePreview } from "@/lib/services/teams";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { createClient } from "@/utils/supabase/server";

/**
 * Publieke uitnodiging-acceptatiepagina — bewust BUITEN de (protected)-
 * route-group (proxy.ts's PROTECTED_PREFIXES bevat geen "/team"), want een
 * niet-ingelogde bezoeker moet de uitnodiging (teamnaam, voor wie) kunnen
 * zien vóórdat die gevraagd wordt in/te loggen. Het token zelf is de
 * toegangscontrole (public.get_team_invite_by_token, zie
 * supabase/migrations/team_plans.sql) — geen extra guard hier nodig.
 */
export default async function TeamInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const [invite, profile] = await Promise.all([
    getTeamInvitePreview(supabase, token),
    getCurrentUserProfile(),
  ]);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-10">
      {!invite ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <CircleAlert className="size-8 text-destructive" />
            <p className="font-semibold">Deze uitnodiging bestaat niet (meer)</p>
            <p className="text-sm text-muted-foreground">
              Controleer of je de volledige link hebt gebruikt, of vraag de teameigenaar om een
              nieuwe uitnodiging.
            </p>
            <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Terug naar GymWiki
            </Link>
          </CardContent>
        </Card>
      ) : (
        <AcceptInviteCard invite={invite} token={token} isLoggedIn={Boolean(profile)} />
      )}
    </main>
  );
}
