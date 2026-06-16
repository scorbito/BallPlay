-- BallPlay team game stats.
--
-- Stores one row per team per KBO game. This table is designed for team-level
-- ranking content that cannot be derived from player season snapshots alone.
-- Run once in the Supabase SQL Editor.

create table if not exists public.bp_team_game_stats (
  id uuid primary key default gen_random_uuid(),

  game_id text not null,
  game_date date not null,
  team_id text not null references public.teams(id),
  opponent_team_id text not null references public.teams(id),
  is_home boolean not null,

  runs integer not null default 0 check (runs >= 0),
  hits integer not null default 0 check (hits >= 0),
  errors integer not null default 0 check (errors >= 0),
  walks integer not null default 0 check (walks >= 0),
  hbp integer not null default 0 check (hbp >= 0),
  strikeouts integer not null default 0 check (strikeouts >= 0),
  rbi integer not null default 0 check (rbi >= 0),

  doubles integer not null default 0 check (doubles >= 0),
  triples integer not null default 0 check (triples >= 0),
  homers integer not null default 0 check (homers >= 0),
  total_bases integer not null default 0 check (total_bases >= 0),

  gidp integer not null default 0 check (gidp >= 0),
  stolen_bases integer not null default 0 check (stolen_bases >= 0),
  caught_stealing integer not null default 0 check (caught_stealing >= 0),
  sacrifice_hits integer not null default 0 check (sacrifice_hits >= 0),
  sacrifice_flies integer not null default 0 check (sacrifice_flies >= 0),

  pitcher_batters_faced integer not null default 0 check (pitcher_batters_faced >= 0),
  pitcher_pitches integer not null default 0 check (pitcher_pitches >= 0),
  pitcher_at_bats integer not null default 0 check (pitcher_at_bats >= 0),
  pitcher_hits_allowed integer not null default 0 check (pitcher_hits_allowed >= 0),
  pitcher_homers_allowed integer not null default 0 check (pitcher_homers_allowed >= 0),
  pitcher_walks_hbp integer not null default 0 check (pitcher_walks_hbp >= 0),
  pitcher_strikeouts integer not null default 0 check (pitcher_strikeouts >= 0),
  pitcher_runs_allowed integer not null default 0 check (pitcher_runs_allowed >= 0),
  pitcher_earned_runs integer not null default 0 check (pitcher_earned_runs >= 0),

  late_runs integer not null default 0 check (late_runs >= 0),
  late_runs_allowed integer not null default 0 check (late_runs_allowed >= 0),

  inning_scores jsonb not null default '[]'::jsonb,
  special_counts jsonb not null default '{}'::jsonb,
  raw_scoreboard jsonb not null default '{}'::jsonb,
  raw_box_score jsonb not null default '{}'::jsonb,

  source text not null default 'kbo-boxscore-scroll',
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (game_id, team_id)
);

alter table public.bp_team_game_stats
  add column if not exists walks integer not null default 0 check (walks >= 0),
  add column if not exists hbp integer not null default 0 check (hbp >= 0),
  add column if not exists strikeouts integer not null default 0 check (strikeouts >= 0),
  add column if not exists rbi integer not null default 0 check (rbi >= 0),
  add column if not exists doubles integer not null default 0 check (doubles >= 0),
  add column if not exists triples integer not null default 0 check (triples >= 0),
  add column if not exists homers integer not null default 0 check (homers >= 0),
  add column if not exists total_bases integer not null default 0 check (total_bases >= 0),
  add column if not exists gidp integer not null default 0 check (gidp >= 0),
  add column if not exists stolen_bases integer not null default 0 check (stolen_bases >= 0),
  add column if not exists caught_stealing integer not null default 0 check (caught_stealing >= 0),
  add column if not exists sacrifice_hits integer not null default 0 check (sacrifice_hits >= 0),
  add column if not exists sacrifice_flies integer not null default 0 check (sacrifice_flies >= 0),
  add column if not exists pitcher_batters_faced integer not null default 0 check (pitcher_batters_faced >= 0),
  add column if not exists pitcher_pitches integer not null default 0 check (pitcher_pitches >= 0),
  add column if not exists pitcher_at_bats integer not null default 0 check (pitcher_at_bats >= 0),
  add column if not exists pitcher_hits_allowed integer not null default 0 check (pitcher_hits_allowed >= 0),
  add column if not exists pitcher_homers_allowed integer not null default 0 check (pitcher_homers_allowed >= 0),
  add column if not exists pitcher_walks_hbp integer not null default 0 check (pitcher_walks_hbp >= 0),
  add column if not exists pitcher_strikeouts integer not null default 0 check (pitcher_strikeouts >= 0),
  add column if not exists pitcher_runs_allowed integer not null default 0 check (pitcher_runs_allowed >= 0),
  add column if not exists pitcher_earned_runs integer not null default 0 check (pitcher_earned_runs >= 0),
  add column if not exists late_runs integer not null default 0 check (late_runs >= 0),
  add column if not exists late_runs_allowed integer not null default 0 check (late_runs_allowed >= 0),
  add column if not exists inning_scores jsonb not null default '[]'::jsonb,
  add column if not exists special_counts jsonb not null default '{}'::jsonb,
  add column if not exists raw_scoreboard jsonb not null default '{}'::jsonb,
  add column if not exists raw_box_score jsonb not null default '{}'::jsonb,
  add column if not exists collected_at timestamptz not null default now();

create index if not exists bp_team_game_stats_date_idx
  on public.bp_team_game_stats (game_date desc);

create index if not exists bp_team_game_stats_team_date_idx
  on public.bp_team_game_stats (team_id, game_date desc);

create index if not exists bp_team_game_stats_opponent_date_idx
  on public.bp_team_game_stats (opponent_team_id, game_date desc);

create or replace function public.bp_team_game_stats_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bp_team_game_stats_updated_at on public.bp_team_game_stats;
create trigger bp_team_game_stats_updated_at
  before update on public.bp_team_game_stats
  for each row execute function public.bp_team_game_stats_set_updated_at();

alter table public.bp_team_game_stats enable row level security;

drop policy if exists "bp_team_game_stats_read_all" on public.bp_team_game_stats;
create policy "bp_team_game_stats_read_all"
on public.bp_team_game_stats for select
to anon, authenticated
using (true);

comment on table public.bp_team_game_stats is
  'Team-level KBO game stats for ranking and report content. One row per team per game.';
