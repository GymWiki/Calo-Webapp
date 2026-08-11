-- Remaps existing public.lessons rows from the previous, fabricated
-- "Basisdocument" leerlijn vocabulary onto the new canonical, categorized
-- taxonomy in lib/constants/learningLines.ts (LEARNING_LINE_CATEGORIES) —
-- the same list already used verbatim by public.activiteiten.leerlijn /
-- .categorie in the live data.
--
-- Deviations from the brief, documented here:
--   * There is no `basisdocument_learning_line` column — `lessons` stores
--     this as `learning_line` (a plain TEXT column; see
--     schema_didactics_and_basisdocument.sql from an earlier round, which
--     deliberately reused this existing column instead of adding a
--     duplicate). This migration updates that column.
--   * This repo's other SQL files live flat under `supabase/` (see
--     schema_*.sql); this one is kept at the brief's literal
--     `supabase/migrations/` path since it doesn't conflict with that
--     convention.
--   * 5 of the 12 old leerlijn values already coincide exactly with a new
--     leerlijn (Balanceren, Zwaaien, Springen, Tikspelen, Trefspelen) and
--     need no remapping. The other 7 map to the closest new leerlijn by
--     judgment call, documented per row below — there is no 1:1 authority
--     to consult for some of these (e.g. "Doelspelen" doesn't correspond
--     to exactly one new Spel-leerlijn).
--   * At the time of writing, `lessons` has 0 rows in the live project, so
--     this UPDATE is currently a no-op — it's still applied so any future
--     rows created before this migration ships against a differently-
--     seeded environment get corrected too.

-- Klimmen (old leerlijn) -> Klauteren (new: Klimmen-category default)
update public.lessons
set learning_line = 'Klauteren'
where learning_line = 'Klimmen';

-- Hardlopen -> Lopen (Atletiek)
update public.lessons
set learning_line = 'Lopen'
where learning_line = 'Hardlopen';

-- Midden- en langafstandlopen -> Lopen (Atletiek)
update public.lessons
set learning_line = 'Lopen'
where learning_line = 'Midden- en langafstandlopen';

-- Werpen, stoten en slingeren -> Werpen (Atletiek)
update public.lessons
set learning_line = 'Werpen'
where learning_line = 'Werpen, stoten en slingeren';

-- Doelspelen -> Passeren en onderscheppen (Spel; closest conceptual match
-- for invasion/goal games among the new Spel-leerlijnen)
update public.lessons
set learning_line = 'Passeren en onderscheppen'
where learning_line = 'Doelspelen';

-- Racketspelen / Honk- en loopspelen -> Honkloopspelen (Spel)
update public.lessons
set learning_line = 'Honkloopspelen'
where learning_line = 'Racketspelen / Honk- en loopspelen';

-- Bewegen op muziek / Bewegen en regelen -> Motieven (Bewegen op muziek)
update public.lessons
set learning_line = 'Motieven'
where learning_line = 'Bewegen op muziek / Bewegen en regelen';
