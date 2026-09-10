import Link from "next/link";
import { Settings } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { UserProfile } from "@/lib/types";

export function ProfileHeader({ profile }: { profile: UserProfile }) {
  const initials = `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase();

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage-URL
          <img
            src={profile.avatar_url}
            alt=""
            className="size-20 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="font-display flex size-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary">
            {initials}
          </div>
        )}
        <div className="flex-1 space-y-2">
          <p className="text-xl font-bold">
            {profile.first_name} {profile.last_name}
          </p>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <Badge variant={profile.available_for_internship ? "success" : "secondary"}>
              {profile.available_for_internship
                ? "Beschikbaar voor stage"
                : "Niet beschikbaar voor stage"}
            </Badge>
          </div>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/profiel/instellingen">
            <Settings className="size-4" />
            Accountinstellingen
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
