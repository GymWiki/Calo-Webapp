-- ============================================================================
-- Fix: lessons.author_id FK must point at public.users, not auth.users
-- ============================================================================
-- schema_activities.sql (literally, per the spec it implemented) created
-- `lessons.author_id uuid references auth.users (id)`. `public.users` also
-- has an FK to `auth.users.id`, but there was never a *direct* FK edge
-- between `lessons` and `public.users` — and PostgREST can only embed a
-- relationship ("author:users(first_name, last_name)", used by
-- lib/services/lessons.ts's getUserLessons/getLessonById/getPublicLessons)
-- when a direct FK exists between the two tables in the query. Symptom:
--   "Could not find a relationship between 'lessons' and 'users' in the
--   schema cache"
--
-- Fix: repoint the FK at public.users(id). Safe here because public.users
-- already has its own FK to auth.users(id) (Fase 1's on_auth_user_created
-- trigger guarantees a public.users row exists for every author before
-- they can ever author a lesson), so every valid author_id against
-- auth.users is also valid against public.users. `lessons` had 0 rows at
-- the time this was applied, so there's nothing to backfill or orphan.
-- ============================================================================

alter table public.lessons
  drop constraint lessons_author_id_fkey;

alter table public.lessons
  add constraint lessons_author_id_fkey
  foreign key (author_id) references public.users (id) on delete cascade;

-- Supabase's hosted Postgres normally auto-reloads PostgREST's schema
-- cache on DDL via an event trigger, but this makes it explicit/immediate
-- rather than relying on that.
notify pgrst, 'reload schema';
