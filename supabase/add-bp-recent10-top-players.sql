-- BallPlay recent 10 games TOP players.
-- 최근 10경기 랭킹을 미리 계산해 저장하는 테이블.
-- 화면에서는 계산하지 않고 category별 TOP 행만 조회할 수 있도록 설계.
-- Supabase SQL Editor에서 1회 실행.

create table if not exists public.bp_recent10_top_players (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  window_start_date date,
  category text not null,
  rank integer not null check (rank > 0),
  player_id text not null,
  player_name text not null,
  team_id text not null references public.teams(id),
  kind text not null check (kind in ('batter', 'pitcher')),
  value numeric not null,
  display_value text not null,
  sub_text text not null,
  stats jsonb not null default '{}'::jsonb,
  source text not null default 'recent10-json',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (snapshot_date, category, rank)
);

alter table public.bp_recent10_top_players
  add column if not exists window_start_date date;

create index if not exists bp_recent10_top_players_date_category_idx
  on public.bp_recent10_top_players (snapshot_date desc, category, rank);

create index if not exists bp_recent10_top_players_player_idx
  on public.bp_recent10_top_players (player_id, snapshot_date desc);

create or replace function public.bp_recent10_top_players_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bp_recent10_top_players_updated_at on public.bp_recent10_top_players;
create trigger bp_recent10_top_players_updated_at
  before update on public.bp_recent10_top_players
  for each row execute function public.bp_recent10_top_players_set_updated_at();

alter table public.bp_recent10_top_players enable row level security;

drop policy if exists "bp_recent10_top_players_read_all" on public.bp_recent10_top_players;
create policy "bp_recent10_top_players_read_all"
on public.bp_recent10_top_players for select
to anon, authenticated
using (true);

comment on table public.bp_recent10_top_players is
  '최근 10경기 선수 TOP 랭킹 사전 계산 결과. category별 TOP 10 화면 조회용.';
