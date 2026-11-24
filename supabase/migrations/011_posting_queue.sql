-- Honest posting queue: the post text, its platform and when it was actually posted.
-- Status values are now draft, ready and posted. Older rows used Scheduled and Published; the app maps them.
alter table public.queue_items add column if not exists content   text        not null default '';
alter table public.queue_items add column if not exists platform  text        not null default 'LinkedIn';
alter table public.queue_items add column if not exists posted_at timestamptz;

update public.queue_items set status = 'ready'  where status = 'Scheduled';
update public.queue_items set status = 'posted' where status = 'Published';

-- Results entries created after Mark as posted wait here until the user adds numbers.
alter table public.perf_entries add column if not exists pending boolean not null default false;
