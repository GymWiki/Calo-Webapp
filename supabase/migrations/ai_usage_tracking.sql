-- Kostentracking voor de daadwerkelijke AI-integratie (OpenAI, zie
-- lib/ai/openai-client.ts — GymWiki gebruikt geen Anthropic/Claude).
-- Losstaand van het bestaande ai_usage_log (dat blijft de gedeelde
-- fair-use-teller voor analyze-lesson/extract-activity); ai_usage is de
-- fijnmazige token/kosten-log per aanroep, incl. de nieuwe, betaalmuur-
-- gebonden lessengenerator-limiet.
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  feature text not null check (
    feature in ('activity_checker', 'lesson_generator', 'ai_lescoach', 'knowledge_base_embedding')
  ),
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_user_created on public.ai_usage (user_id, created_at desc);
create index if not exists idx_ai_usage_feature_created on public.ai_usage (feature, created_at desc);

alter table public.ai_usage enable row level security;
alter table public.ai_usage force row level security;

-- Zelfde vertrouwensmodel als het bestaande ai_usage_log: elke gebruiker
-- mag alleen zijn eigen rijen inzien en alleen rijen op zijn eigen naam
-- aanmaken (de server-side call draait altijd met de sessie van de
-- aanroepende gebruiker, nooit met een service-role).
drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "ai_usage_insert_own" on public.ai_usage;
create policy "ai_usage_insert_own" on public.ai_usage
  for insert
  with check ((select auth.uid()) = user_id);

-- ============================================================================
-- Rapportage voor de eigenaar — bewust drie views i.p.v. een nieuwe in-app
-- adminrol (die bestaat sinds de freemium-refactor niet meer, zie
-- remove_user_roles.sql). Query rechtstreeks via de Supabase SQL editor,
-- dezelfde workflow die nu al voor materialen/kennisbank-beheer gebruikt
-- wordt. select expliciet ingetrokken van anon/authenticated: dit
-- aggregeert de kosten van ALLE gebruikers, dus mag nooit via de publieke
-- PostgREST-API bereikbaar zijn voor een gewone ingelogde gebruiker.
-- ============================================================================

create or replace view public.ai_usage_monthly_summary as
select
  date_trunc('month', created_at)::date as month,
  feature,
  count(*) as call_count,
  sum(input_tokens) as total_input_tokens,
  sum(output_tokens) as total_output_tokens,
  round(sum(estimated_cost_usd), 4) as total_cost_usd
from public.ai_usage
group by 1, 2
order by 1 desc, 2;

revoke all on public.ai_usage_monthly_summary from public, anon, authenticated;

create or replace view public.ai_usage_monthly_cost_per_paid_user as
select
  date_trunc('month', au.created_at)::date as month,
  round(sum(au.estimated_cost_usd), 4) as total_cost_usd,
  count(distinct case when u.subscription_status = 'paid_subscriber' then au.user_id end)
    as paid_users_with_usage,
  round(
    sum(au.estimated_cost_usd)
      / nullif(count(distinct case when u.subscription_status = 'paid_subscriber' then au.user_id end), 0),
    4
  ) as avg_cost_per_paid_user_usd
from public.ai_usage au
join public.users u on u.id = au.user_id
group by 1
order by 1 desc;

revoke all on public.ai_usage_monthly_cost_per_paid_user from public, anon, authenticated;

create or replace view public.ai_usage_top_lesson_generator_users as
select
  au.user_id,
  u.first_name,
  u.last_name,
  u.subscription_status,
  count(*) filter (where au.created_at >= date_trunc('month', now())) as generations_this_month,
  round(sum(au.estimated_cost_usd) filter (where au.created_at >= date_trunc('month', now())), 4)
    as cost_this_month_usd,
  count(*) as generations_all_time
from public.ai_usage au
join public.users u on u.id = au.user_id
where au.feature = 'lesson_generator'
group by au.user_id, u.first_name, u.last_name, u.subscription_status
order by generations_this_month desc;

revoke all on public.ai_usage_top_lesson_generator_users from public, anon, authenticated;
