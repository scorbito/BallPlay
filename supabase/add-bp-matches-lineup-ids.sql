-- ============================================================
-- bp_matches: home_lineup_id / away_lineup_id 컬럼 추가.
-- 친구 대전이라도 양쪽 다 공개 라인업이면 정식 매치로 집계되도록 하기 위한 사전 준비.
--
-- 흐름:
--   1. CreateLiveMatchScreen: 방장이 공개 라인업 선택 시 home_lineup_id 채움
--   2. LiveMatchScreen(join): 참가자가 공개 라인업 선택 시 away_lineup_id 채움
--   3. PlayScreen 종료 시: bp_matches 의 두 컬럼을 읽어 bp_records 의 lineup_id 들에 그대로 인서트
--   4. bp_lineup_stats view: source 무관, 양쪽 lineup_id 가 NOT NULL 인 record 만 집계
--
-- 실행 1회. 멱등성 보장(if not exists).
-- ============================================================

alter table public.bp_matches
  add column if not exists home_lineup_id uuid references public.bp_lineups(id) on delete set null;

alter table public.bp_matches
  add column if not exists away_lineup_id uuid references public.bp_lineups(id) on delete set null;

comment on column public.bp_matches.home_lineup_id is
  '홈 측이 선택한 공개 라인업 ID. 비공개/임시 라인업이면 null. bp_records 의 home_lineup_id 와 연결되어 정식 매치 판정에 사용.';
comment on column public.bp_matches.away_lineup_id is
  '어웨이 측이 선택한 공개 라인업 ID. 비공개/임시 라인업이면 null.';

-- ============================================================
-- bp_lineup_stats view 재정의 — source 게이트 제거, 양쪽 lineup_id NOT NULL 게이트로 변경
-- 이전: where source = 'public'  (친구 대전 제외)
-- 변경: where home_lineup_id is not null and away_lineup_id is not null
--       (출처 무관, 양쪽 다 공개 라인업이면 정식 매치)
-- ============================================================

create or replace view public.bp_lineup_stats as
with own_matches as (
  select
    case when user_side = 'home' then home_lineup_id else away_lineup_id end as lineup_id,
    case
      when user_side = 'home' and (final_score->>'home')::int > (final_score->>'away')::int then 1
      when user_side = 'away' and (final_score->>'away')::int > (final_score->>'home')::int then 1
      else 0
    end as win,
    case
      when user_side = 'home' and (final_score->>'home')::int < (final_score->>'away')::int then 1
      when user_side = 'away' and (final_score->>'away')::int < (final_score->>'home')::int then 1
      else 0
    end as loss,
    case when (final_score->>'home')::int = (final_score->>'away')::int then 1 else 0 end as draw
  from public.bp_records
  where home_lineup_id is not null
    and away_lineup_id is not null
)
select
  lineup_id,
  count(*)::int as matches,
  coalesce(sum(win), 0)::int as wins,
  coalesce(sum(loss), 0)::int as losses,
  coalesce(sum(draw), 0)::int as draws
from own_matches
where lineup_id is not null
group by lineup_id;

comment on view public.bp_lineup_stats is
  '본인이 도전한 정식 매치(양쪽 모두 공개 라인업)만 집계. source 무관.';
