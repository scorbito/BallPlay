-- BallPlay bp_sim_results — 매일 09시 KST cron이 오늘 경기 1000판 시뮬 결과를 캐싱하는 테이블.
--
-- 적용 방법:
--   1) Supabase SQL Editor에서 본 파일 1회 실행 (idempotent 아님 — table 존재 시 에러).
--   2) 이미 적용된 환경에서는 본 SQL 재실행하지 말 것.
--   3) 운영 DB와 공유되는 프로젝트이므로, 적용 전 사용자 확인 필수.
--
-- 정책:
--   - (game_id, game_date) unique — 같은 경기/같은 날 1행만. cron 재실행 시 UPSERT 로 갱신.
--   - 읽기는 모두 허용(공개 야구 데이터), 쓰기는 service_role(cron)만.
--   - jsonb 컬럼은 시뮬 raw 집계 (히스토그램·박스스코어·MVP 빈도).
--   - engine_version 은 lib/sim/version.ts 의 SIM_ENGINE_VERSION 과 일치. 엔진 bump 시 다음 cron이 덮어씀.

create table public.bp_sim_results (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  game_date date not null,
  run_at timestamptz not null default now(),

  -- 라인업 메타
  home_team_id text not null,
  away_team_id text not null,
  home_starter text,
  away_starter text,
  lineup_source_home date,
  lineup_source_away date,

  -- 결과 요약
  n integer not null default 1000,
  home_wins integer not null,
  away_wins integer not null,
  ties integer not null,
  home_avg_runs numeric(5,2) not null,
  away_avg_runs numeric(5,2) not null,
  extra_inning_count integer not null,

  -- 분포·선수·MVP (jsonb)
  diff_hist jsonb not null,
  batters jsonb not null,
  pitchers jsonb not null,
  mvp_freq jsonb not null,

  -- 엔진 버전
  engine_version text not null,

  unique (game_id, game_date)
);

create index bp_sim_results_game_date_idx on public.bp_sim_results (game_date desc);

alter table public.bp_sim_results enable row level security;

-- 공개 read — 누구나 결과 조회 가능 (페이지에서 anon 키로 fetch)
create policy "bp_sim_results_read_all"
on public.bp_sim_results for select
to anon, authenticated
using (true);

-- INSERT/UPDATE/DELETE 정책 없음 → service_role(RLS 우회)만 쓰기 가능.

comment on table public.bp_sim_results is
  '매일 09시 KST cron 이 오늘 경기 1000판 시뮬 결과를 캐싱. (game_id, game_date) unique. /predict/sim-1000 페이지가 조회.';
