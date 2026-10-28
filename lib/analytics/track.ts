// Privacyvriendelijke gebeurtenissen voor de gratis plattegrondtool. GymWiki heeft (nog) geen analytics-systeem, geen cookies
// en geen trackers: deze functie stuurt daarom NIETS over het netwerk. Ze zet alleen een DOM-event (`gymwiki:event`) en
// een regel in de console in development, zodat later één provider (bijv. Plausible zonder cookies) op één plek kan inhaken
// zonder dat de aanroepers veranderen. Er worden nooit persoonsgegevens of plattegrond-inhoud meegestuurd.

export type GymwikiEvent =
  | "editor_gestart"
  | "eerste_item_geplaatst"
  | "export_png"
  | "export_pdf"
  | "deelbare_link"
  | "upsell_getoond"
  | "account_aangemaakt_vanuit_editor";

export function trackEvent(name: GymwikiEvent, props: Record<string, string | number | boolean> = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("gymwiki:event", { detail: { name, ...props } }));
    if (process.env.NODE_ENV === "development") console.debug("[gymwiki:event]", name, props);
  } catch {
    // analytics mag nooit iets stukmaken
  }
}
