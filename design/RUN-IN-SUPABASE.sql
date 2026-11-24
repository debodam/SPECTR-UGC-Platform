-- SPECTR: everything to run once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Combines migrations 002 to 011 in order. Every statement is idempotent: tables and columns that already
-- exist are left alone, so running it twice, or on a database that already has some of these tables, is safe.
-- 001 (profiles and the signup trigger) is left out on purpose so an existing signup trigger is never replaced.
-- It all runs in one transaction: if anything fails, nothing is changed.
-- Generated from supabase/migrations on 2026-11-24.

begin;

-- Preflight: every table below belongs to a company, so public.companies must already exist.
do $$
begin
  if to_regclass('public.companies') is null then
    raise exception 'public.companies is missing. Create the companies table first, then run this file again.';
  end if;
end $$;

-- ═══ supabase/migrations/002_workspaces.sql ═══
-- Workspace config per user+company (metrics, goals, audience)
create table if not exists public.workspaces (
  id                    uuid        primary key default gen_random_uuid(),
  company_id            uuid        not null references public.companies (id) on delete cascade,
  user_id               uuid        not null references auth.users (id) on delete cascade,
  industry              text,
  primary_platform      text        not null default 'LinkedIn',
  starting_from_scratch boolean     not null default false,
  baseline              jsonb       not null default '{}',
  targets               jsonb       not null default '{}',
  goal_description      text,
  audience              jsonb       not null default '{}',
  setup_complete        boolean     not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (company_id, user_id)
);

alter table public.workspaces enable row level security;

-- Users can only read/write their own workspace rows
drop policy if exists "Users can manage own workspaces" on public.workspaces;
create policy "Users can manage own workspaces"
  on public.workspaces for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ═══ supabase/migrations/003_perf_entries.sql ═══
-- Performance log entries scoped to a company
create table if not exists public.perf_entries (
  id               uuid          primary key default gen_random_uuid(),
  company_id       uuid          not null references public.companies (id) on delete cascade,
  user_id          uuid          not null references auth.users (id) on delete cascade,
  date             date          not null,
  title            text          not null default '',
  format           text          not null default 'Article',
  source           text          not null default 'Transcript',
  impressions      integer       not null default 0,
  engagement_rate  numeric(6,2)  not null default 0,
  followers_gained integer       not null default 0,
  notes            text          not null default '',
  created_at       timestamptz   not null default now()
);

alter table public.perf_entries enable row level security;

drop policy if exists "Users can manage own perf_entries" on public.perf_entries;
create policy "Users can manage own perf_entries"
  on public.perf_entries for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fast lookups by company
create index if not exists perf_entries_company_date
  on public.perf_entries (company_id, date desc);

-- ═══ supabase/migrations/004_queue_items.sql ═══
-- Publish queue entries scoped to a company
create table if not exists public.queue_items (
  id         uuid        primary key default gen_random_uuid(),
  company_id uuid        not null references public.companies (id) on delete cascade,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  title      text        not null default '',
  format     text        not null default 'Article',
  date       date        not null,
  time       text        not null default '09:00',
  status     text        not null default 'Scheduled',
  created_at timestamptz not null default now()
);

alter table public.queue_items enable row level security;

drop policy if exists "Users can manage own queue_items" on public.queue_items;
create policy "Users can manage own queue_items"
  on public.queue_items for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fast lookups by company ordered by schedule
create index if not exists queue_items_company_date
  on public.queue_items (company_id, date, time);

-- ═══ supabase/migrations/005_company_logo.sql ═══
alter table public.companies add column if not exists logo_url text;

-- ═══ supabase/migrations/006_generations.sql ═══
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  format text not null,
  content text not null,
  created_at timestamptz default now() not null
);

alter table public.generations enable row level security;

drop policy if exists "Users manage their own generations" on public.generations;
create policy "Users manage their own generations"
  on public.generations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists generations_company_user_idx
  on public.generations(company_id, user_id, created_at desc);

-- ═══ supabase/migrations/007_saved_contexts.sql ═══
create table if not exists public.saved_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  text text not null,
  created_at timestamptz default now() not null
);

alter table public.saved_contexts enable row level security;

drop policy if exists "Users manage their own saved contexts" on public.saved_contexts;
create policy "Users manage their own saved contexts"
  on public.saved_contexts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists saved_contexts_user_idx
  on public.saved_contexts(user_id, created_at desc);

-- ═══ supabase/migrations/008_transcripts.sql ═══
create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  transcript_text text not null,
  duration_seconds integer not null default 0,
  created_at timestamptz default now() not null
);

alter table public.transcripts enable row level security;

drop policy if exists "Users manage their own transcripts" on public.transcripts;
create policy "Users manage their own transcripts"
  on public.transcripts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists transcripts_company_user_idx
  on public.transcripts(company_id, user_id, created_at desc);

-- ═══ supabase/migrations/009_growth_engine.sql ═══
-- Growth Engine: plans, weekly plays, experiments and insights.
-- Every row belongs to a workspace (company + user) and is owned by the user, same RLS style as existing tables.

create table if not exists public.growth_plans (
  id                 uuid        primary key default gen_random_uuid(),
  workspace_id       uuid        not null references public.workspaces (id) on delete cascade,
  user_id            uuid        not null references auth.users (id) on delete cascade,
  north_star_metric  text        not null,
  north_star_key     text        not null default 'followers',
  goal_summary       text        not null default '',
  pillars            jsonb       not null default '[]',   -- [{ name, description, share }]
  cadence_per_week   integer     not null default 3,
  channels           jsonb       not null default '["LinkedIn"]',
  audience_summary   text        not null default '',
  history            jsonb       not null default '[]',   -- [{ at, change, source }]
  active             boolean     not null default true,
  created_at         timestamptz not null default now()
);

create table if not exists public.plays (
  id                 uuid        primary key default gen_random_uuid(),
  workspace_id       uuid        not null references public.workspaces (id) on delete cascade,
  user_id            uuid        not null references auth.users (id) on delete cascade,
  plan_id            uuid        references public.growth_plans (id) on delete cascade,
  week_start         date        not null,
  title              text        not null,
  type               text        not null check (type in ('founder story','contrarian take','customer win','build in public','launch','hiring','how-to')),
  hook               text        not null default '',
  rationale          text        not null default '',
  pillar             text        not null default '',
  format             text        not null check (format in ('article','post','video script')),
  status             text        not null default 'suggested' check (status in ('suggested','in progress','recorded','transformed','scheduled','posted','measured')),
  linked_log_id      uuid        references public.transcripts (id) on delete set null,
  linked_content_id  uuid        references public.generations (id) on delete set null,
  results            jsonb       not null default '{}',   -- { impressions, engagementRate, followersGained, entries }
  created_at         timestamptz not null default now()
);

create table if not exists public.experiments (
  id          uuid        primary key default gen_random_uuid(),
  workspace_id uuid       not null references public.workspaces (id) on delete cascade,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  play_id     uuid        not null references public.plays (id) on delete cascade,
  hypothesis  text        not null default '',
  variant_a   text        not null,
  variant_b   text        not null,
  metric      text        not null default 'impressions' check (metric in ('impressions','engagementRate','followersGained')),
  result      jsonb       not null default '{}',   -- { a: { value, entries }, b: { value, entries } }
  winner      text        check (winner in ('a','b')),
  learning    text        not null default '',
  status      text        not null default 'running' check (status in ('running','complete')),
  created_at  timestamptz not null default now()
);

create table if not exists public.insights (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references public.workspaces (id) on delete cascade,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  text         text        not null,
  kind         text        not null check (kind in ('pattern','recommendation','warning')),
  evidence     jsonb       not null default '{}',   -- computed numbers plus an optional { action } for recommendations
  applied      boolean     not null default false,
  created_at   timestamptz not null default now()
);

alter table public.growth_plans enable row level security;
alter table public.plays        enable row level security;
alter table public.experiments  enable row level security;
alter table public.insights     enable row level security;

-- Owner can do everything, and only inside a workspace they own.
drop policy if exists "Users manage own growth_plans" on public.growth_plans;
create policy "Users manage own growth_plans" on public.growth_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.workspaces w where w.id = workspace_id and w.user_id = auth.uid()));
drop policy if exists "Users manage own plays" on public.plays;
create policy "Users manage own plays" on public.plays for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.workspaces w where w.id = workspace_id and w.user_id = auth.uid()));
drop policy if exists "Users manage own experiments" on public.experiments;
create policy "Users manage own experiments" on public.experiments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.workspaces w where w.id = workspace_id and w.user_id = auth.uid()));
drop policy if exists "Users manage own insights" on public.insights;
create policy "Users manage own insights" on public.insights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.workspaces w where w.id = workspace_id and w.user_id = auth.uid()));

create index if not exists growth_plans_workspace_idx on public.growth_plans (workspace_id, created_at desc);
create index if not exists plays_workspace_week_idx   on public.plays (workspace_id, week_start desc);
create index if not exists experiments_workspace_idx  on public.experiments (workspace_id, created_at desc);
create index if not exists insights_workspace_idx     on public.insights (workspace_id, created_at desc);

-- Link existing pipeline rows to the play they came from.
alter table public.transcripts  add column if not exists play_id uuid references public.plays (id) on delete set null;
alter table public.generations  add column if not exists play_id uuid references public.plays (id) on delete set null;
alter table public.queue_items  add column if not exists play_id uuid references public.plays (id) on delete set null;
alter table public.perf_entries add column if not exists play_id uuid references public.plays (id) on delete set null;
alter table public.perf_entries add column if not exists variant text check (variant in ('a','b'));

-- ═══ supabase/migrations/010_growth_prefs.sql ═══
-- Strategy choices collected in Setup (focus, weekly time, formats, topics, voice, accounts to avoid).
-- Stored on the existing workspaces row, so its RLS policy already applies.
alter table public.workspaces add column if not exists growth_prefs jsonb not null default '{}';

-- ═══ supabase/migrations/011_posting_queue.sql ═══
-- Honest posting queue: the post text, its platform and when it was actually posted.
-- Status values are now draft, ready and posted. Older rows used Scheduled and Published; the app maps them.
alter table public.queue_items add column if not exists content   text        not null default '';
alter table public.queue_items add column if not exists platform  text        not null default 'LinkedIn';
alter table public.queue_items add column if not exists posted_at timestamptz;

update public.queue_items set status = 'ready'  where status = 'Scheduled';
update public.queue_items set status = 'posted' where status = 'Published';

-- Results entries created after Mark as posted wait here until the user adds numbers.
alter table public.perf_entries add column if not exists pending boolean not null default false;

commit;
