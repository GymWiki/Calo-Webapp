-- ============================================================================
-- Fase 5 — Zaal-Plattegrond Builder
-- ============================================================================
-- Adds diagram storage to the existing `lessons` table (uuid PK, unchanged
-- since "Volledige activiteiten-/lessendatabase"). No FK/type reconciliation
-- needed this time — the literal spec matches the live schema directly.
--
-- `diagram_image_url` holds a base64 PNG data URL exported from the canvas
-- (per spec: "zet het canvas het beeld om naar een data-URL/Base64"), not a
-- Storage-hosted URL — simplest to implement and matches the literal ask.
-- If diagrams grow large/numerous, moving to Storage-hosted images (like
-- the activiteiten-afbeeldingen bucket) would be a natural follow-up.
-- ============================================================================

alter table public.lessons
  add column if not exists diagram_data jsonb,
  add column if not exists diagram_image_url text;
