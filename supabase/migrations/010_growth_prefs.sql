-- Strategy choices collected in Setup (focus, weekly time, formats, topics, voice, accounts to avoid).
-- Stored on the existing workspaces row, so its RLS policy already applies.
alter table public.workspaces add column if not exists growth_prefs jsonb not null default '{}';
