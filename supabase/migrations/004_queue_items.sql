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

create policy "Users can manage own queue_items"
  on public.queue_items for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fast lookups by company ordered by schedule
create index if not exists queue_items_company_date
  on public.queue_items (company_id, date, time);
