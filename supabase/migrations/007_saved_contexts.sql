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
