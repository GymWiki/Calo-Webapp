"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type {
  TournamentSchedule,
  TournamentScores,
  TournamentSettings,
} from "@/types/tournament";

type SaveTournamentResult = { error: string } | { success: true; id: string };

const GENERIC_ERROR = "Toernooi opslaan is mislukt. Probeer het opnieuw.";

export async function saveTournament(input: {
  title: string;
  settings: TournamentSettings;
  schedule: TournamentSchedule;
  scores: TournamentScores;
}): Promise<SaveTournamentResult> {
  if (!input.title.trim()) {
    return { error: "Geef het toernooi een naam voordat je het opslaat." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      author_id: user.id,
      title: input.title.trim(),
      settings: input.settings,
      schedule: input.schedule,
      scores: input.scores,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: GENERIC_ERROR };
  }

  return { success: true, id: data.id };
}
