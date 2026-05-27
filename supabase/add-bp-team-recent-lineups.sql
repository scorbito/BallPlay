-- BallPlay bp_team_recent_lineups — 팀별 경기 선발 라인업 스냅샷.
--
-- 목적:
--   KBO 박스스코어(GetBoxScore)에서 경기별 선발 9인 타순 + 선발투수를 긁어 누적 저장.
--   용도 3가지:
--     1. AI 승리팀 예측 — 양팀 최근 라인업으로 시뮬 N회 → 승률
--     2. 라인업 짜기 시드 — "실제 최근 라인업 불러오기"
--     3. 경기장 AI 대결 — 자동생성 대신 실제 팀 라인업
--
-- 정책:
--   - (game_id, team_id) unique — 한 경기당 팀별 1행 (양팀이면 2행)
--   - 누적 보관 (retention 없음 — 시즌 1MB 미만이라 부담 0)
--   - 예상 라인업 생성 시엔 team_id + 최근 10경기(game_date DESC LIMIT 10) 조회 후 최빈 산출
--   - 매일 cron으로 어제 경기 수집 → upsert
--   - roster 매칭은 스크래퍼에서 이름 기반 (박스스코어에 playerId 없음). roster_id가 null이면
--     매칭 실패한 선수 — 이름은 보존해서 후속 보정 가능.
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

create table if not exists public.bp_team_recent_lineups (
  id uuid primary key default gen_random_uuid(),

  game_id text not null,                 -- KBO G_ID, 예: "20260527KTOB0"
  game_date date not null,
  team_id text not null references public.teams(id),
  is_home boolean not null,

  -- 선발 타순 9인 — [{ order:1, rosterId:"doosan-2"|null, name:"정수빈", position:"CF" }, ...]
  batting jsonb not null,

  -- 선발투수 (GetKboGameList 기준이 더 안정적이라 거기서 채움)
  starter_roster_id text,
  starter_name text,

  source text not null default 'kbo-boxscore',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (game_id, team_id)
);

-- 예상 라인업 생성용 — 팀별 최근 경기 빠른 조회
create index if not exists bp_team_recent_lineups_team_date_idx
  on public.bp_team_recent_lineups (team_id, game_date desc);

-- updated_at 자동 갱신
create or replace function public.bp_team_recent_lineups_set_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists bp_team_recent_lineups_updated_at on public.bp_team_recent_lineups;
create trigger bp_team_recent_lineups_updated_at
  before update on public.bp_team_recent_lineups
  for each row execute function public.bp_team_recent_lineups_set_updated_at();

-- ============================================================
-- RLS — 읽기는 모두 허용(공개 야구 데이터), 쓰기는 service_role(스크래퍼/cron)만.
-- ============================================================
alter table public.bp_team_recent_lineups enable row level security;

drop policy if exists "bp_team_recent_lineups_read_all" on public.bp_team_recent_lineups;
create policy "bp_team_recent_lineups_read_all"
on public.bp_team_recent_lineups for select
to anon, authenticated
using (true);

-- INSERT/UPDATE/DELETE 정책 없음 → service_role(RLS 우회)만 쓰기 가능.

comment on table public.bp_team_recent_lineups is
  'KBO 박스스코어 기반 팀별 경기 선발 라인업 스냅샷. 예상 라인업/AI 예측/라인업 시드용. (game_id, team_id) unique.';
