-- BallPlay pitcher game logs and pitcher-vs-team aggregates.
--
-- Source data comes from bp_team_game_stats.raw_box_score.pitcher.
-- Run once in the Supabase SQL Editor before running the backfill script.

create table if not exists public.bp_pitcher_game_logs (
  id uuid primary key default gen_random_uuid(),

  game_id text not null,
  game_date date not null,
  team_id text not null references public.teams(id),
  opponent_team_id text not null references public.teams(id),
  is_home boolean not null,

  pitcher_name text not null,
  pitcher_order text,
  result text,

  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  saves integer not null default 0 check (saves >= 0),
  holds integer not null default 0 check (holds >= 0),

  outs integer not null default 0 check (outs >= 0),
  innings_text text not null default '0',
  batters_faced integer not null default 0 check (batters_faced >= 0),
  pitches integer not null default 0 check (pitches >= 0),
  at_bats integer not null default 0 check (at_bats >= 0),
  hits_allowed integer not null default 0 check (hits_allowed >= 0),
  homers_allowed integer not null default 0 check (homers_allowed >= 0),
  walks_hbp integer not null default 0 check (walks_hbp >= 0),
  strikeouts integer not null default 0 check (strikeouts >= 0),
  runs_allowed integer not null default 0 check (runs_allowed >= 0),
  earned_runs integer not null default 0 check (earned_runs >= 0),
  era_after numeric,

  raw_cells jsonb not null default '[]'::jsonb,
  source text not null default 'bp-team-game-stats-raw-box-score',
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (game_id, team_id, pitcher_name, pitcher_order)
);

create index if not exists bp_pitcher_game_logs_date_idx
  on public.bp_pitcher_game_logs (game_date desc);

create index if not exists bp_pitcher_game_logs_pitcher_date_idx
  on public.bp_pitcher_game_logs (pitcher_name, game_date desc);

create index if not exists bp_pitcher_game_logs_pitcher_opponent_idx
  on public.bp_pitcher_game_logs (pitcher_name, opponent_team_id, game_date desc);

create table if not exists public.bp_pitcher_vs_team_stats (
  id uuid primary key default gen_random_uuid(),

  pitcher_name text not null,
  team_id text not null references public.teams(id),
  opponent_team_id text not null references public.teams(id),

  games integer not null default 0 check (games >= 0),
  starts integer not null default 0 check (starts >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  saves integer not null default 0 check (saves >= 0),
  holds integer not null default 0 check (holds >= 0),

  outs integer not null default 0 check (outs >= 0),
  innings numeric not null default 0,
  batters_faced integer not null default 0 check (batters_faced >= 0),
  pitches integer not null default 0 check (pitches >= 0),
  hits_allowed integer not null default 0 check (hits_allowed >= 0),
  homers_allowed integer not null default 0 check (homers_allowed >= 0),
  walks_hbp integer not null default 0 check (walks_hbp >= 0),
  strikeouts integer not null default 0 check (strikeouts >= 0),
  runs_allowed integer not null default 0 check (runs_allowed >= 0),
  earned_runs integer not null default 0 check (earned_runs >= 0),

  era numeric,
  whip numeric,
  k9 numeric,
  bb9 numeric,
  last_game_date date,
  updated_at timestamptz not null default now(),

  unique (pitcher_name, team_id, opponent_team_id)
);

create index if not exists bp_pitcher_vs_team_stats_lookup_idx
  on public.bp_pitcher_vs_team_stats (pitcher_name, opponent_team_id);

create or replace function public.bp_pitcher_game_logs_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bp_pitcher_game_logs_updated_at on public.bp_pitcher_game_logs;
create trigger bp_pitcher_game_logs_updated_at
  before update on public.bp_pitcher_game_logs
  for each row execute function public.bp_pitcher_game_logs_set_updated_at();

alter table public.bp_pitcher_game_logs enable row level security;
alter table public.bp_pitcher_vs_team_stats enable row level security;

drop policy if exists "bp_pitcher_game_logs_read_all" on public.bp_pitcher_game_logs;
create policy "bp_pitcher_game_logs_read_all"
on public.bp_pitcher_game_logs for select
to anon, authenticated
using (true);

drop policy if exists "bp_pitcher_vs_team_stats_read_all" on public.bp_pitcher_vs_team_stats;
create policy "bp_pitcher_vs_team_stats_read_all"
on public.bp_pitcher_vs_team_stats for select
to anon, authenticated
using (true);

comment on table public.bp_pitcher_game_logs is
  'Parsed pitcher-level game logs derived from collected KBO box score raw data.';

comment on table public.bp_pitcher_vs_team_stats is
  'Cached pitcher-vs-opponent-team aggregates for prediction detail pages.';
