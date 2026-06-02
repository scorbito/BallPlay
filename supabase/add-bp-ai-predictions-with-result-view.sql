-- BallPlay bp_ai_predictions_with_result — AI 예측 + 경기 결과 라이브 조인 view.
--
-- 목적:
--   기존엔 cron(23:30 KST)이 bp_ai_predictions.is_correct 컬럼을 채워주는 방식이었음.
--   문제는 점수가 들어왔는데도 자정 가까이 돼야 적중/실패가 표시된다는 점.
--   사용자 예측(bp_predictions)은 이미 bp_prediction_results VIEW 로 games 조인 →
--   점수 입력 즉시 라이브 판정 중. AI 예측도 동일한 패턴으로 통일.
--
-- 흐름:
--   1. sync-kbo-games cron 이 games.home_score / away_score / status 갱신
--   2. 이 VIEW 가 games 조인해서 is_correct_live 즉석 계산
--   3. 페이지/RPC 가 이 VIEW 만 보면 cron 한 번 더 안 돌아도 즉시 반영
--
-- 컬럼:
--   - bp_ai_predictions 의 모든 컬럼 그대로 (is_correct 도 남겨둠 — deprecated, 사용 안 함)
--   - games 조인 컬럼: home_team_id, away_team_id, home_score, away_score, status(as game_status)
--   - is_judged: status='finished' AND 양쪽 점수 not null AND 무승부 아님 (= 승부가 갈린 상태)
--   - actual_winner_team_id: 점수 비교로 결정. 동점이면 NULL.
--   - is_correct_live: is_judged=true 이고 픽팀=실제승리팀 이면 true. 동점은 false. 아직 안 끝났으면 NULL.
--
-- RLS:
--   bp_ai_predictions 의 RLS(published_at <= now()) 를 상속해야 함.
--   Postgres VIEW 는 기본적으로 view owner 권한으로 동작 → security_invoker = true 로
--   호출자(anon/authenticated) 권한으로 평가하게 만들어 published_at 필터를 자연 적용.
--
-- 본 SQL 은 idempotent — Supabase SQL Editor 에서 1회 실행.

create or replace view public.bp_ai_predictions_with_result
with (security_invoker = true) as
select
  p.id,
  p.game_id,
  p.game_date,
  p.ai_provider,
  p.model_name,
  p.predicted_winner_team_id,
  p.confidence,
  p.key_factor,
  p.one_liner,
  p.detailed_analysis,
  p.published_at,
  p.is_correct,                                              -- deprecated. 새 로직은 is_correct_live 사용.
  p.created_at,
  p.updated_at,
  g.status as game_status,
  g.home_team_id,
  g.away_team_id,
  g.home_score,
  g.away_score,
  -- status='finished' 가 아니어도 양쪽 점수가 모두 들어와 있으면 종료로 간주.
  -- KBO sync 가 status 늦게 올리는 경우(점수만 먼저 들어오는 케이스) 대응.
  case
    when g.home_score is not null and g.away_score is not null
         and g.home_score > g.away_score then g.home_team_id
    when g.home_score is not null and g.away_score is not null
         and g.away_score > g.home_score then g.away_team_id
    else null
  end as actual_winner_team_id,
  case
    when g.home_score is not null and g.away_score is not null
         and g.home_score <> g.away_score then true
    else false
  end as is_judged,
  case
    when g.home_score is not null and g.away_score is not null
         and g.home_score > g.away_score and p.predicted_winner_team_id = g.home_team_id then true
    when g.home_score is not null and g.away_score is not null
         and g.away_score > g.home_score and p.predicted_winner_team_id = g.away_team_id then true
    when g.home_score is not null and g.away_score is not null
         and g.home_score <> g.away_score then false
    else null
  end as is_correct_live
from public.bp_ai_predictions p
join public.games g on g.id = p.game_id;

comment on view public.bp_ai_predictions_with_result is
  'AI 예측 + games 라이브 조인 view. 점수 입력 즉시 is_correct_live 로 적중/실패 판정. is_correct 컬럼은 deprecated.';

-- ============================================================
-- 적중률 RPC — 기존 함수를 VIEW 기반으로 교체.
-- 시그니처/리턴 타입은 유지 (page/query helper 가 그대로 호출).
-- 차이점: is_correct (cron 채움) 대신 is_correct_live (즉시 계산) 사용.
-- ============================================================

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
    count(*) filter (where is_judged = true)::bigint as total_count,
    count(*) filter (where is_correct_live = true)::bigint as correct_count,
    case
      when count(*) filter (where is_judged = true) = 0 then null
      else round(
        count(*) filter (where is_correct_live = true)::numeric
        / count(*) filter (where is_judged = true) * 100,
        1
      )
    end as accuracy
  from public.bp_ai_predictions_with_result
  where game_date >= p_since
    and published_at <= now();
$$;

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
    v.ai_provider,
    count(*) filter (where v.is_judged = true)::bigint as total_count,
    count(*) filter (where v.is_correct_live = true)::bigint as correct_count,
    case
      when count(*) filter (where v.is_judged = true) = 0 then null
      else round(
        count(*) filter (where v.is_correct_live = true)::numeric
        / count(*) filter (where v.is_judged = true) * 100,
        1
      )
    end as accuracy
  from public.bp_ai_predictions_with_result v
  where v.game_date >= p_since
    and v.published_at <= now()
  group by v.ai_provider
  order by accuracy desc nulls last;
$$;

grant execute on function public.bp_ai_predictions_overall_stats(date) to anon, authenticated;
grant execute on function public.bp_ai_predictions_by_provider_stats(date) to anon, authenticated;
