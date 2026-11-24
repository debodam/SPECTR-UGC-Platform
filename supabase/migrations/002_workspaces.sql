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
