import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { LIBRARY_PREVIEW_LIMIT } from "@/lib/permissions";

// Fisher-Yates — hoeft geen cryptografisch-veilige randomness te zijn (Math.
// random volstaat): het resultaat wordt hieronder direct opgeslagen, dus de
// "willekeurigheid" hoeft maar één keer eerlijk te zijn, niet herhaalbaar-
// onvoorspelbaar.
function pickRandomPreviewIds(candidateActivityIds: string[]): string[] {
  const pool = [...candidateActivityIds];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, LIBRARY_PREVIEW_LIMIT);
}

/**
 * Vaste preview-set voor een free_blocked-gebruiker (zie de brief): zonder
 * dit toonde de bibliotheek steeds de eerste LIBRARY_PREVIEW_LIMIT kaarten
 * van WAT DAN OOK net gefilterd was — filteren/zoeken herschikt welke
 * activiteiten die "eerste N" zijn, dus een gebruiker kon de preview-limiet
 * omzeilen door simpelweg een ander filter te proberen en zo een heel
 * andere set activiteiten te zien.
 *
 * Wordt éénmalig — bij het eerste bezoek — willekeurig gekozen uit de volle,
 * dan actuele bibliotheek en op public.users.library_preview_activity_ids
 * opgeslagen. Blijft daarna ONGEWIJZIGD, ongeacht welke filters de
 * gebruiker toepast, tot hij weer bijdraagt/upgrade — op dat moment is
 * hasFullLibraryAccess weer true en wordt dit veld simpelweg niet meer
 * gelezen (geen reset nodig, zie lib/permissions.ts).
 *
 * `existingIds` komt uit profile.library_preview_activity_ids (zie
 * getCurrentUserProfile) — null betekent "nog nooit berekend voor deze
 * gebruiker". Een reeds opgeslagen lege array (`[]`, bijv. omdat de
 * bibliotheek leeg was bij het eerste bezoek) telt bewust ook als "al
 * berekend" en wordt niet opnieuw gegenereerd; anders zou een gebruiker die
 * toevallig als allereerste langskwam bij een lege bibliotheek elke keer
 * een nieuwe (net zo lege) set krijgen totdat er activiteiten bijkomen.
 */
export async function getOrCreateLibraryPreviewActivityIds(
  userId: string,
  existingIds: string[] | null,
  candidateActivityIds: string[],
): Promise<string[]> {
  if (existingIds !== null) {
    return existingIds;
  }

  const previewIds = pickRandomPreviewIds(candidateActivityIds);

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  // Best-effort: als de update faalt (netwerk/RLS-edge case), toon de
  // zojuist berekende set toch gewoon — bij de volgende page load wordt
  // dan simpelweg opnieuw (mogelijk een andere) preview-set berekend, wat
  // hooguit een eenmalige "reroll" betekent, nooit een kapotte pagina.
  await supabase
    .from("users")
    .update({ library_preview_activity_ids: previewIds })
    .eq("id", userId);

  return previewIds;
}
