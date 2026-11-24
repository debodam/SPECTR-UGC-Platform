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
create policy "Users manage own growth_plans" on public.growth_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.workspaces w where w.id = workspace_id and w.user_id = auth.uid()));
create policy "Users manage own plays" on public.plays for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.workspaces w where w.id = workspace_id and w.user_id = auth.uid()));
create policy "Users manage own experiments" on public.experiments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.workspaces w where w.id = workspace_id and w.user_id = auth.uid()));
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
