import type { ElementType } from "./gym-canvas-types";

const STORAGE_BASE =
  "https://dxdopwhxteodgeaebfpp.supabase.co/storage/v1/object/public/activiteiten-afbeeldingen";

function storagePath(...segments: string[]): string {
  return `${STORAGE_BASE}/${segments.map(encodeURIComponent).join("/")}`;
}

// Materiaal-iconen gematcht aan de afbeeldingen die de gebruiker heeft
// geüpload naar de "Materiaal/"-map in de activiteiten-afbeeldingen bucket.
// Elementtypes zonder entry hier vallen terug op het bestaande
// vector-icoon uit ElementIcon (zie material-images-mapping.md-achtige
// toelichting in de PR/commit-message voor de volledige redenatie).
export const MATERIAL_IMAGE_URLS: Partial<Record<ElementType, string>> = {
  kast_klein: storagePath("Materiaal", "Kast zonder kop laag zijaanzicht.png"),
  kast_groot: storagePath("Materiaal", "Kast zonder kop hoog zijaanzicht.png"),
  turnbank: storagePath("Materiaal", "Bank zijkant.png"),
  mat_dik: storagePath("Materiaal", "Dikke mat boven.png"),
  mat_klein: storagePath("Materiaal", "Matje zijaanzicht.png"),
  trampoline: storagePath("Materiaal", "Minitramp boven.png"),
  korf: storagePath("Materiaal", "Korf bovenaanzicht.png"),
  doel: storagePath("Materiaal", "Goal Boven.png"),
  pion: storagePath("Materiaal", "Pilon boven.png"),
  hoepel: storagePath("Materiaal", "Hoepel blauw boven.png"),
  bal_basketbal: storagePath("Materiaal", "Basketbal.png"),
  bal_korfbal: storagePath("Materiaal", "Korfbal.png"),
  speler_rood: storagePath("Materiaal", "Leerling Rood Boven.png"),
  speler_blauw: storagePath("Materiaal", "Leerling Blauw boven.png"),
};
