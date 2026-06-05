-- BallPlay product event log.
--
-- Run once in the Supabase SQL Editor. This table is intentionally append-only
-- from the client side; analytics queries and cleanup should use service_role.

create table if not exists public.bp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  anonymous_id text,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  pathname text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists bp_events_event_name_created_at_idx
  on public.bp_events(event_name, created_at desc);

create index if not exists bp_events_user_created_at_idx
  on public.bp_events(user_id, created_at desc);

create index if not exists bp_events_anonymous_created_at_idx
  on public.bp_events(anonymous_id, created_at desc);

alter table public.bp_events enable row level security;

drop policy if exists "insert events" on public.bp_events;
create policy "insert events" on public.bp_events
  for insert
  to anon, authenticated
  with check (user_id is null or auth.uid() = user_id);

-- No client-side select/update/delete policies by design.
comment on table public.bp_events is
  'Client product analytics event log. Clients can insert only; reads are service_role/admin queries.';
