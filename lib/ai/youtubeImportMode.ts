// Centrale, server-side modus-schakelaar voor "Activiteit uit video" se
// YouTube-linkinvoer — bewust GEEN door de eindgebruiker instelbare optie
// (geen UI-toggle, geen per-gebruiker voorkeur), en bewust ook geen
// database-instelling die via een admin-UI live wisselt: dit is een
// bedrijfsbrede risico-afweging, ingesteld via een omgevingsvariabele die
// alleen bij een herdeploy verandert.
//
// WAAROM DEZE SCHAKELAAR BESTAAT (lees dit vóór je 'm omzet):
// - 'transcript_only' (standaard, VEILIG): haalt alleen de al-gepubliceerde
//   ondertiteling van een YouTube-video op — GEEN download van de video
//   zelf. Dit blijft binnen wat YouTube's eigen afspeel-/ondertitel-UI ook
//   doet, en is het risicoarme pad.
// - 'full_auto': downloadt de volledige video server-side om 'm precies als
//   een geüpload bestand te verwerken (audio-extractie, frame-extractie).
//   Het downloaden van YouTube-video's is in strijd met YouTube's
//   Terms of Service (§ "Permissions and Restrictions" verbiedt downloaden
//   behalve via een door YouTube aangeboden downloadknop), ongeacht dat de
//   content zelf publiek toegankelijk is. Handhaving hiervan door YouTube
//   wisselt sterk (van nooit tot account-/API-sancties), wat dit een
//   bewuste, per-bedrijf risico-afweging maakt — geen technisch besluit.
//   Zie app/(protected)/beheer/ai-import/page.tsx voor de zichtbare
//   disclaimer die alleen admins te zien krijgen wanneer deze modus actief
//   staat.
//
// Omschakelen tussen de modi is dus puur een configuratiewijziging
// (YOUTUBE_IMPORT_MODE=full_auto in de omgevingsvariabelen + herdeploy),
// geen nieuwe ontwikkeling — beide routes zijn volledig uitgebouwd (zie
// lib/ai/youtubeTranscriptFetch.ts resp. lib/ai/youtubeDownload.ts +
// lib/ai/videoFrameExtraction.ts) en delen dezelfde fasenmachine
// (lib/ai/videoImportProcessor.ts) en reviewstap.
export type YoutubeImportMode = "transcript_only" | "full_auto";

export const YOUTUBE_IMPORT_MODE: YoutubeImportMode =
  process.env.YOUTUBE_IMPORT_MODE === "full_auto" ? "full_auto" : "transcript_only";
