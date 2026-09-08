-- GymWiki-refactor: verwijdert het volledige gamification-systeem (XP,
-- levels, login-streaks, lidmaatschapsjubileum) — vervangen door het
-- bijdrage-freemium-model in subscription_model.sql. Alle statements zijn
-- idempotent ("if exists"), dus veilig opnieuw te draaien.

-- 1. RPC's die alleen voor gamification bestonden.
drop function if exists public.award_xp(uuid, integer, text, uuid);
drop function if exists public.award_xp(uuid, integer);
drop function if exists public.record_login_activity(uuid);

-- 2. XP-historie.
drop table if exists public.xp_log;

-- 3. Gamification-kolommen op users. Bijbehorende CHECK-constraints
-- (users_xp_non_negative, users_login_streak_non_negative) verdwijnen
-- automatisch mee — Postgres droppt constraints die een kolom raken zodra
-- die kolom wordt gedropt.
alter table public.users
  drop column if exists xp,
  drop column if exists login_streak_current,
  drop column if exists login_streak_longest,
  drop column if exists last_active_at,
  drop column if exists member_since,
  drop column if exists last_anniversary_bonus_year;
