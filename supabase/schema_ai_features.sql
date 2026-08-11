-- AI-integratie vervolgstappen: Game-Based Pedagogy velden op lessen, een
-- Pro-vlag + fair-use tracking voor de nieuwe AI-endpoints
-- (app/api/ai/analyze-lesson, app/api/ai/generate-activity).
--
-- Deviations from the brief, documented here:
--   * The brief doesn't specify a storage shape for Game-Based Pedagogy —
--     `game_dimensions` is stored as one JSONB object ({space, equipment,
--     people, rules}) rather than 4 separate columns, matching this repo's
--     existing convention for structured-but-small per-lesson data (see
--     `diagram_data` on this same table).
--   * "Pro" has no billing/payment integration in this app yet (out of
--     scope here) — `users.is_pro` is a plain boolean an admin would flip
--     manually for now, mirroring how the `admin` role itself has no
--     self-serve UI either.
--   * Fair-use is enforced by counting rows in `ai_usage_log` for the
--     current calendar month, rather than a running counter column, so
--     usage naturally resets each month without a cron job.

alter table public.lessons
  add column if not exists game_category text,
  add column if not exists game_dimensions jsonb,
  add column if not exists tactical_questions text[] not null default '{}';

alter table public.users
  add column if not exists is_pro boolean not null default false;

create table if not exists public.ai_usage_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  endpoint text not null check (endpoint in ('analyze-lesson', 'generate-activity')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists ai_usage_log_user_id_created_at_idx
  on public.ai_usage_log (user_id, created_at);

alter table public.ai_usage_log enable row level security;
alter table public.ai_usage_log force row level security;

create policy "ai_usage_log_select_own"
  on public.ai_usage_log for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "ai_usage_log_insert_own"
  on public.ai_usage_log for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
