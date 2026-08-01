-- BallPlay — AI 종합분석 리포트 테이블.
-- 목적: 3개 AI 예측이 모두 입력된 뒤, 경기별 "종합분석 리포트"(AI 의견 종합 + 정밀데이터 근거)를
--       Claude 가 작성해 저장. 종합분석 탭(/predict/consensus, AI 예측 상세 탭)이 이 본문을 표시한다.
-- 배경: 템플릿 자동 조립 문장은 데이터 나열에 그침 → 작성형 리포트를 DB 에 두고 배포 없이 매일 갱신.
--
-- 정책:
--   - 종합픽/확률/만장일치 여부는 화면에서 실시간 계산 — 이 테이블은 "리포트 본문"이 원본.
--   - (game_id) unique — 경기당 1건, 재작성은 UPSERT.
--   - RLS: published_at <= now() 만 SELECT 허용 (bp_ai_predictions 와 동일 규칙). write 는 service_role.
--
-- 본 SQL 은 idempotent — Supabase SQL Editor 에서 1회 실행하면 됨.

create table if not exists public.bp_ai_consensus_daily (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.games(id) on delete cascade,
  game_date     date not null,
  pick_team_id  text not null,              -- 작성 시점의 종합픽 (참고 기록용)
  probability   numeric(4, 3) not null,     -- 작성 시점의 종합 확률 (참고 기록용)
  is_unanimous  boolean not null,
  analysis      text not null,              -- 종합분석 리포트 본문
  model_name    text not null,
  published_at  timestamptz not null,       -- 그날 09:00 KST — 도달 시 자동 공개
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (game_id)
);

create index if not exists idx_bp_ai_consensus_daily_date
  on public.bp_ai_consensus_daily (game_date desc);

alter table public.bp_ai_consensus_daily enable row level security;

drop policy if exists "bp_ai_consensus_daily_read_published" on public.bp_ai_consensus_daily;
create policy "bp_ai_consensus_daily_read_published"
  on public.bp_ai_consensus_daily
  for select
  to anon, authenticated
  using (published_at <= now());

comment on table public.bp_ai_consensus_daily is
  'AI 3사 종합분석 리포트 (경기당 1건). 종합픽 수치는 화면에서 계산, 본 테이블은 작성형 리포트 본문이 원본.';
