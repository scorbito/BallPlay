-- BallPlay custom teams — official user-owned teams.
--
-- Goal:
--   Treat "my team" as a first-class official team that can be used by
--   bp_lineups, bp_records, rankings, and playoff flows.
--
-- Team id convention:
--   KBO teams:    doosan, lg, kt, ...
--   Custom teams: custom:<uuid>
--
-- This keeps existing text team_id columns usable while giving custom teams
-- a globally unique official team id.

create table if not exists public.bp_custom_teams (
  id text primary key default ('custom:' || gen_random_uuid()::text),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  initials text not null,
  color text not null default '#8b5cf6',
  badge_style text not null default 'shield' check (badge_style in ('circle', 'shield')),
  scout_pieces integer not null default 0 check (scout_pieces >= 0),
  is_public boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bp_custom_teams_id_check check (id like 'custom:%'),
  constraint bp_custom_teams_initials_len check (char_length(initials) between 1 and 4)
);

create unique index if not exists bp_custom_teams_one_active_per_user_idx
  on public.bp_custom_teams (owner_user_id)
  where is_active = true;

create index if not exists bp_custom_teams_public_idx
  on public.bp_custom_teams (is_public, is_active, updated_at desc)
  where is_public = true and is_active = true;

drop trigger if exists bp_custom_teams_updated_at on public.bp_custom_teams;
create trigger bp_custom_teams_updated_at
  before update on public.bp_custom_teams
  for each row execute function public.handle_updated_at();

create table if not exists public.bp_custom_team_players (
  id uuid primary key default gen_random_uuid(),
  custom_team_id text not null references public.bp_custom_teams(id) on delete cascade,
  player_id text not null,
  acquired_source text not null default 'recruit',
  acquired_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (custom_team_id, player_id)
);

create index if not exists bp_custom_team_players_team_idx
  on public.bp_custom_team_players (custom_team_id, acquired_at desc);

-- Extend bp_lineups so a custom official lineup can point back to its custom team.
-- For custom teams, client code should set:
--   team_id = bp_custom_teams.id
--   lineup_type = 'custom'
--   custom_team_id = bp_custom_teams.id
alter table public.bp_lineups
  add column if not exists is_archived boolean not null default false;

alter table public.bp_lineups
  add column if not exists archived_at timestamptz;

alter table public.bp_lineups
  add column if not exists lineup_type text not null default 'kbo'
    check (lineup_type in ('kbo', 'national', 'custom'));

alter table public.bp_lineups
  add column if not exists custom_team_id text references public.bp_custom_teams(id) on delete set null;

create index if not exists bp_lineups_custom_team_idx
  on public.bp_lineups (custom_team_id)
  where custom_team_id is not null;

create index if not exists bp_lineups_custom_public_idx
  on public.bp_lineups (updated_at desc)
  where lineup_type = 'custom' and is_published = true and coalesce(is_archived, false) = false;

-- Optional match/result snapshots for custom team badges.
-- Existing home_label/away_label already preserve names; these metadata columns
-- preserve badge color/style without requiring old custom team rows to exist forever.
alter table public.bp_records
  add column if not exists home_team_meta jsonb not null default '{}'::jsonb;

alter table public.bp_records
  add column if not exists away_team_meta jsonb not null default '{}'::jsonb;

do $$
begin
  if to_regclass('public.bp_playoff_runs') is not null then
    alter table public.bp_playoff_runs
      add column if not exists team_meta jsonb not null default '{}'::jsonb;
  end if;

  if to_regclass('public.bp_playoff_champions') is not null then
    alter table public.bp_playoff_champions
      add column if not exists team_meta jsonb not null default '{}'::jsonb;
  end if;
end $$;

alter table public.bp_custom_teams enable row level security;
alter table public.bp_custom_team_players enable row level security;

drop policy if exists "bp_custom_teams_select_public_or_own" on public.bp_custom_teams;
create policy "bp_custom_teams_select_public_or_own"
on public.bp_custom_teams for select
to authenticated
using (is_public = true or owner_user_id = auth.uid());

drop policy if exists "bp_custom_teams_insert_own" on public.bp_custom_teams;
create policy "bp_custom_teams_insert_own"
on public.bp_custom_teams for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "bp_custom_teams_update_own" on public.bp_custom_teams;
create policy "bp_custom_teams_update_own"
on public.bp_custom_teams for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "bp_custom_teams_delete_own" on public.bp_custom_teams;
create policy "bp_custom_teams_delete_own"
on public.bp_custom_teams for delete
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "bp_custom_team_players_select_visible_team" on public.bp_custom_team_players;
create policy "bp_custom_team_players_select_visible_team"
on public.bp_custom_team_players for select
to authenticated
using (
  exists (
    select 1
    from public.bp_custom_teams t
    where t.id = custom_team_id
      and (t.is_public = true or t.owner_user_id = auth.uid())
  )
);

drop policy if exists "bp_custom_team_players_insert_own" on public.bp_custom_team_players;
create policy "bp_custom_team_players_insert_own"
on public.bp_custom_team_players for insert
to authenticated
with check (
  exists (
    select 1
    from public.bp_custom_teams t
    where t.id = custom_team_id
      and t.owner_user_id = auth.uid()
  )
);

drop policy if exists "bp_custom_team_players_delete_own" on public.bp_custom_team_players;
create policy "bp_custom_team_players_delete_own"
on public.bp_custom_team_players for delete
to authenticated
using (
  exists (
    select 1
    from public.bp_custom_teams t
    where t.id = custom_team_id
      and t.owner_user_id = auth.uid()
  )
);

comment on table public.bp_custom_teams is
  'User-owned official teams. Their id uses custom:<uuid> and can be stored in existing team_id text columns.';
comment on table public.bp_custom_team_players is
  'Owned KBO player pool for each official custom team.';
comment on column public.bp_lineups.lineup_type is
  'kbo/national/custom. Custom lineups are official my-team lineups.';
comment on column public.bp_lineups.custom_team_id is
  'References bp_custom_teams.id when lineup_type=custom.';
