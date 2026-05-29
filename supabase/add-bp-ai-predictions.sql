-- BallPlay bp_ai_predictions — AI 3개(Gemini/Claude/GPT)의 KBO 경기 승리팀 예측.
--
-- 흐름:
--   1. 매일 아침 Claude Code / Codex / Antigravity 가 각자 세션으로 레포에 참여
--   2. 데이터 분석 → bp_ai_predictions INSERT (service_role 사용)
--   3. published_at <= now() 인 row 만 클라이언트가 select 가능 (09:00 KST 자동 공개)
--   4. 경기 종료 후 sync-kbo-games cron 이 home_score/away_score 와 비교해서 is_correct 채움
--
-- 정책:
--   - (game_id, ai_provider) unique — 한 경기 × 한 AI = 1행
--   - confidence 0.5~1.0 (반대팀이 이길 거라 보면 그 팀을 winner 로 지정)
--   - SELECT (anon/authenticated): published_at <= now() 인 row 만 노출
--     → INSERT 전에 다른 AI 결과를 못 보게 자연 차단 (단, service_role 은 우회 가능)
--   - INSERT/UPDATE/DELETE: service_role 만 (AI 가 직접 작업)
--
-- 본 SQL 은 idempotent — Supabase SQL Editor 에서 1회 실행.

-- ============================================================
-- 테이블
-- ============================================================

create table if not exists public.bp_ai_predictions (
  id uuid primary key default gen_random_uuid(),

  -- 어떤 경기
  game_id uuid not null references public.games(id) on delete cascade,
  game_date date not null,                                  -- 인덱싱·당일 노출 필터용

  -- 누가 예측
  ai_provider text not null
    check (ai_provider in ('gemini', 'claude', 'gpt')),
  model_name text,                                          -- 'claude-opus-4-7' / 'gemini-2.5-pro' / 'gpt-5' 등 (옵션)

  -- 예측 내용
  predicted_winner_team_id text not null references public.teams(id),
  confidence numeric not null
    check (confidence >= 0.5 and confidence <= 1.0),

  -- 분석
  key_factor text not null,                                 -- '최근폼' / '선발 매치업' / '홈 이점' 등 자유 텍스트 (~10자)
  one_liner text not null,                                  -- 카드/요약용 1~2문장
  detailed_analysis text not null,                          -- reveal 토글용 4~6문장

  -- 공개·채점
  published_at timestamptz not null,                        -- AI 가 INSERT 시 그날 09:00 KST 로 박음
  is_correct boolean,                                       -- 경기 종료 후 sync-kbo-games cron 이 채움. 무승부는 false 처리.

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 한 경기 × 한 AI = 1행
  unique (game_id, ai_provider)
);

-- ============================================================
-- 인덱스
-- ============================================================

-- 당일 경기 목록 조회 — 가장 잦은 쿼리
create index if not exists bp_ai_predictions_date_pub_idx
  on public.bp_ai_predictions (game_date desc, published_at);

-- AI 별 적중률 집계 — RPC 에서 사용
create index if not exists bp_ai_predictions_provider_correct_idx
  on public.bp_ai_predictions (ai_provider, is_correct)
  where is_correct is not null;

-- 채점 cron 이 한 경기에 대해 3행 update 할 때
create index if not exists bp_ai_predictions_game_id_idx
  on public.bp_ai_predictions (game_id);

-- ============================================================
-- updated_at 자동 갱신
-- ============================================================

create or replace function public.bp_ai_predictions_set_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists bp_ai_predictions_updated_at on public.bp_ai_predictions;
create trigger bp_ai_predictions_updated_at
  before update on public.bp_ai_predictions
  for each row execute function public.bp_ai_predictions_set_updated_at();

-- ============================================================
-- RLS — published_at <= now() 인 row 만 select. write 는 service_role.
-- ============================================================

alter table public.bp_ai_predictions enable row level security;

drop policy if exists "bp_ai_predictions_read_published" on public.bp_ai_predictions;
create policy "bp_ai_predictions_read_published"
on public.bp_ai_predictions for select
to anon, authenticated
using (published_at <= now());

-- INSERT/UPDATE/DELETE 정책 없음 → service_role(RLS 우회) 만 쓰기 가능.

comment on table public.bp_ai_predictions is
  'AI 3개(Gemini/Claude/GPT)의 KBO 승리팀 예측. published_at 도달 시 자동 공개. (game_id, ai_provider) unique.';

-- ============================================================
-- 적중률 RPC — 클라이언트가 통계 카드 쉽게 가져가도록.
-- 무승부(home_score = away_score)는 is_correct=false 로 채점되므로 따로 처리 안 함.
-- p_since 는 시즌 시작일 등을 넘겨 시즌 통산/최근 30일 등 유연하게.
-- ============================================================

-- 전체 AI 종합 적중률
create or replace function public.bp_ai_predictions_overall_stats(
  p_since date default '2026-03-01'
)
returns table (
  total_count bigint,
  correct_count bigint,
  accuracy numeric
)
language sql stable as $$
  select
    count(*) filter (where is_correct is not null)::bigint as total_count,
    count(*) filter (where is_correct = true)::bigint as correct_count,
    case
      when count(*) filter (where is_correct is not null) = 0 then null
      else round(
        count(*) filter (where is_correct = true)::numeric
        / count(*) filter (where is_correct is not null) * 100,
        1
      )
    end as accuracy
  from public.bp_ai_predictions
  where game_date >= p_since
    and published_at <= now();
$$;

-- AI 별 적중률
create or replace function public.bp_ai_predictions_by_provider_stats(
  p_since date default '2026-03-01'
)
returns table (
  ai_provider text,
  total_count bigint,
  correct_count bigint,
  accuracy numeric
)
language sql stable as $$
  select
    p.ai_provider,
    count(*) filter (where p.is_correct is not null)::bigint as total_count,
    count(*) filter (where p.is_correct = true)::bigint as correct_count,
    case
      when count(*) filter (where p.is_correct is not null) = 0 then null
      else round(
        count(*) filter (where p.is_correct = true)::numeric
        / count(*) filter (where p.is_correct is not null) * 100,
        1
      )
    end as accuracy
  from public.bp_ai_predictions p
  where p.game_date >= p_since
    and p.published_at <= now()
  group by p.ai_provider
  order by accuracy desc nulls last;
$$;

grant execute on function public.bp_ai_predictions_overall_stats(date) to anon, authenticated;
grant execute on function public.bp_ai_predictions_by_provider_stats(date) to anon, authenticated;
