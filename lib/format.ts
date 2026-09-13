export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Sommige oudere `learning_outcomes`-rijen (activiteiten-bibliotheek) hebben
// hun hele, met newlines genummerde/gebulletpointte tekst in ÉÉN
// array-element staan i.p.v. losse elementen — zie
// supabase/migrations/split_learning_outcomes_into_array_items.sql voor de
// eenmalige datamigratie die dit voor bestaande rijen corrigeert. Deze
// functie is de weergave-laag-tegenhanger daarvan: een defensieve fallback
// die elk array-item alsnog op newlines splitst en een leidende "1. "/"- "
// markering strip (de lijst-component nummert zelf al), zodat ook niet
// (nog) gemigreerde of onverwacht opnieuw zo aangeleverde data nooit meer
// als één samengeklonterde alinea wordt getoond.
export function splitLearningOutcomeItems(items: string[] | null | undefined): string[] {
  if (!items) return [];
  return items
    .flatMap((item) => item.split(/\r?\n+/))
    .map((line) => line.trim().replace(/^(?:[0-9]+[.)]\s*|[-•]\s*)/, "").trim())
    .filter((line) => /[\p{L}\p{N}]/u.test(line));
}
