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
