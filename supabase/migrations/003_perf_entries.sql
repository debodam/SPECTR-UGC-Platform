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
