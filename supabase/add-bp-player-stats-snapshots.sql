-- BallPlay bp_player_stats_snapshots — 선수 시즌 누적 능력치 주간 스냅샷.
--
-- 목적:
--   매주 월요일 새벽 cron이 KBO에서 시즌 누적 스탯을 받아 통째로 저장.
--   같은 데이터를 두 가지로 사용:
--     1. 최신 스냅샷 = 현재 시즌 능력치 (baseline JSON보다 항상 신선)
--     2. 두 스냅샷 차이 = 그 주 실제 성적 (recent form / 주간 델타)
--
-- 정책:
--   - (snapshot_date, player_id, kind) unique — 한 주에 선수당 1행
--   - 카운팅/레이트 모두 jsonb sim_payload에 SimBatter/SimPitcher 그대로 저장
--   - 클라 시뮬은 매치 시작 시 출전 선수(~30명) latest+previous 두 스냅샷만 fetch
--   - 누적 보관 (시즌 30주 × 700명 × 2 ≈ 40k 행, 부담 없음)
--   - 이적 시 team_id가 바뀔 수 있음 — player_id가 source of truth
--   - 시즌 종료 후 final 스냅샷은 [[project-season-stats-archive]] 참고
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

create table if not exists public.bp_player_stats_snapshots (
  id uuid primary key default gen_random_uuid(),

  snapshot_date date not null,           -- 수집 시점 (KST 기준 일자, 보통 월요일)
  player_id text not null,               -- roster id (예: "doosan-2")
  team_id text not null references public.teams(id),
  kind text not null check (kind in ('batter', 'pitcher')),

  -- SimBatter / SimPitcher 통째 — pa/ab/hits/hr/avg/obp/slg/era/whip 등 시즌 누적
  sim_payload jsonb not null,

  source text not null default 'kbo-record',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (snapshot_date, player_id, kind)
);

-- 매치 시작 시 출전 선수의 최신 2개 스냅샷 fetch — 자주 쓰는 패턴
create index if not exists bp_player_stats_snapshots_player_date_idx
  on public.bp_player_stats_snapshots (player_id, snapshot_date desc);

-- 팀 단위 fetch (라인업 미리보기 등)
create index if not exists bp_player_stats_snapshots_team_date_idx
  on public.bp_player_stats_snapshots (team_id, snapshot_date desc);

-- updated_at 자동 갱신
create or replace function public.bp_player_stats_snapshots_set_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists bp_player_stats_snapshots_updated_at on public.bp_player_stats_snapshots;
create trigger bp_player_stats_snapshots_updated_at
  before update on public.bp_player_stats_snapshots
  for each row execute function public.bp_player_stats_snapshots_set_updated_at();

-- ============================================================
-- RLS — 읽기는 모두 허용(공개 야구 데이터), 쓰기는 service_role(cron/seed)만.
-- ============================================================
alter table public.bp_player_stats_snapshots enable row level security;

drop policy if exists "bp_player_stats_snapshots_read_all" on public.bp_player_stats_snapshots;
create policy "bp_player_stats_snapshots_read_all"
on public.bp_player_stats_snapshots for select
to anon, authenticated
using (true);

-- INSERT/UPDATE/DELETE 정책 없음 → service_role(RLS 우회)만 쓰기 가능.

comment on table public.bp_player_stats_snapshots is
  'KBO 시즌 누적 선수 스탯 주간 스냅샷. 최신=시즌 능력치, 두 스냅샷 차분=주간 델타. (snapshot_date, player_id, kind) unique.';
