create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  transcript_text text not null,
  duration_seconds integer not null default 0,
  created_at timestamptz default now() not null
);

alter table public.transcripts enable row level security;

create policy "Users manage their own transcripts"
  on public.transcripts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists transcripts_company_user_idx
  on public.transcripts(company_id, user_id, created_at desc);
