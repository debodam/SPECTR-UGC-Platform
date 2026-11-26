-- SPECTR security lock-down. Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Safe to run again. One transaction: if anything fails, nothing changes.
--
-- 1. companies: row level security on, and ONLY these rules (any older, looser policy is removed):
--    you can see a company you created or have a workspace in; only its creator can create, edit or delete it.
-- 2. company-docs storage: private bucket; each user can only read and write files in their own folder.
-- 3. Row level security confirmed on every app table.
-- The last query prints a report you can read in the Results tab.

begin;

-- 1. companies ---------------------------------------------------------------------------------------------
alter table public.companies enable row level security;

do $$
declare p record;
begin
  -- Remove every existing policy on companies, including any "allow all" left over from setup.
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'companies' loop
    execute format('drop policy %I on public.companies', p.policyname);
  end loop;
end $$;

create policy "Companies: members can read" on public.companies for select
  using (
    created_by = auth.uid()
    or exists (select 1 from public.workspaces w where w.company_id = companies.id and w.user_id = auth.uid())
  );
create policy "Companies: creator can insert" on public.companies for insert
  with check (created_by = auth.uid());
create policy "Companies: creator can update" on public.companies for update
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "Companies: creator can delete" on public.companies for delete
  using (created_by = auth.uid());

-- 2. company-docs storage ----------------------------------------------------------------------------------
-- Uploaded company briefs are private: files live at <user id>/..., and only that user can touch them.
update storage.buckets set public = false where id = 'company-docs';

drop policy if exists "company-docs: owner can read" on storage.objects;
drop policy if exists "company-docs: owner can upload" on storage.objects;
drop policy if exists "company-docs: owner can update" on storage.objects;
drop policy if exists "company-docs: owner can delete" on storage.objects;
create policy "company-docs: owner can read" on storage.objects for select
  using (bucket_id = 'company-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "company-docs: owner can upload" on storage.objects for insert
  with check (bucket_id = 'company-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "company-docs: owner can update" on storage.objects for update
  using (bucket_id = 'company-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "company-docs: owner can delete" on storage.objects for delete
  using (bucket_id = 'company-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Row level security on every app table -----------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','companies','workspaces','perf_entries','queue_items','generations',
    'saved_contexts','transcripts','growth_plans','plays','experiments','insights'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

commit;

-- Report: every public table, whether row level security is on, and how many policies it has.
-- Anything with rls_on = false or policies = 0 needs a look.
select c.relname as table_name,
       c.relrowsecurity as rls_on,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;
