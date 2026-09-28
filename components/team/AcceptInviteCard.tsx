"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2, Users } from "lucide-react";

import { acceptTeamInvite } from "@/actions/team";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TeamInvitePreview } from "@/types/team";

/**
 * Ingelogd → direct koppelen na bevestiging. Niet ingelogd → eerst inloggen/
 * registreren, daarna terug naar deze uitnodiging (redirectTo, zie
 * app/(auth)/login/login-form.tsx + register-form.tsx).
 */
export function AcceptInviteCard({
  invite,
  token,
  isLoggedIn,
}: {
  invite: TeamInvitePreview;
  token: string;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  if (invite.status !== "pending") {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="font-semibold">
            {invite.status === "accepted"
              ? "Deze uitnodiging is al geaccepteerd."
              : invite.status === "revoked"
                ? "Deze uitnodiging is ingetrokken door de teameigenaar."
                : "Deze uitnodiging is verlopen."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (accepted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <CircleCheck className="size-8 text-success" />
          <p className="font-semibold">Je bent nu lid van &quot;{invite.teamName}&quot;</p>
          <p className="text-sm text-muted-foreground">Je hebt meteen volledige toegang tot GymWiki.</p>
          <Button asChild>
            <Link href="/dashboard">Naar je dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const redirectParam = encodeURIComponent(`/team/uitnodiging/${token}`);

  function handleAccept() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await acceptTeamInvite(token);
      if ("error" in result) {
        setErrorMessage(result.error);
        return;
      }
      setAccepted(true);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="size-6" />
        </span>
        <p className="font-semibold">Je bent uitgenodigd voor &quot;{invite.teamName}&quot;</p>
        <p className="text-sm text-muted-foreground">
          Voor {invite.email} — accepteer om meteen volledige toegang tot GymWiki te krijgen,
          inclusief de AI Lescoach, zonder zelf te betalen.
        </p>

        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

        {isLoggedIn ? (
          <Button type="button" disabled={isPending} onClick={handleAccept}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Uitnodiging accepteren
          </Button>
        ) : (
          <div className="flex w-full flex-col gap-2">
            <Button asChild>
              <Link href={`/register?redirectTo=${redirectParam}`}>Account aanmaken &amp; accepteren</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/login?redirectTo=${redirectParam}`}>Ik heb al een account</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
