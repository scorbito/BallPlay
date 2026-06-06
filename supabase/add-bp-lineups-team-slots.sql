-- BallPlay team-slot model update
--
-- 2026-06-06:
--   - The app now treats one slot as one operated team.
--   - Published teams remain editable; changing the lineup no longer requires
--     switching to private or resetting records.
--   - New duplicate-team prevention is handled in the client for new slots.
--
-- Run once in the Supabase SQL Editor after deploying the client changes.

-- The live trigger (bp_lineups_immutable_check) is wired to
-- bp_lineups_immutable_when_published() — see update-bp-lineups-public-model.sql
-- and allow-bp-lineups-name-change-when-published.sql. The old *_when_registered()
-- function was already DROPPED, so we must relax the *published* function here.
-- Previously it blocked batting/pitching edits while is_published=true; the
-- team-slot model lets published teams freely edit their lineup, so we now only
-- block changing the base team (구단). No re-wiring needed — the trigger already
-- points at this function.
create or replace function public.bp_lineups_immutable_when_published()
returns trigger language plpgsql as $$
begin
  if OLD.is_published = true and NEW.is_published = true then
    if NEW.team_id is distinct from OLD.team_id then
      raise exception '등록된 팀의 구단은 변경할 수 없습니다';
    end if;
  end if;
  return NEW;
end;
$$;

comment on function public.bp_lineups_immutable_when_published() is
  'Team-slot model: 출전 중(public) 팀도 라인업/이름을 자유롭게 수정 가능. 구단(team_id) 변경만 차단.';

-- Representative team record: only games the owner directly started as home.
-- Mirror/opponent rows where another user challenged this team have user_side='away'
-- and are intentionally excluded from the main record.
create or replace view public.bp_lineup_stats as
with home_matches as (
  select
    home_lineup_id as lineup_id,
    case when (final_score->>'home')::int > (final_score->>'away')::int then 1 else 0 end as win,
    case when (final_score->>'home')::int < (final_score->>'away')::int then 1 else 0 end as loss,
    case when (final_score->>'home')::int = (final_score->>'away')::int then 1 else 0 end as draw
  from public.bp_records
  where user_side = 'home'
    and source = 'public'  -- 친선/연습 매치는 대표 전적 제외
    and home_lineup_id is not null
    and away_lineup_id is not null
)
select
  lineup_id,
  count(*)::int as matches,
  coalesce(sum(win), 0)::int as wins,
  coalesce(sum(loss), 0)::int as losses,
  coalesce(sum(draw), 0)::int as draws
from home_matches
group by lineup_id;

comment on view public.bp_lineup_stats is
  '팀 대표 전적. 사용자가 직접 실행한 홈경기(user_side=home)만 집계하고, 다른 유저가 도전한 원정/방어 기록은 제외한다.';

-- Away/defense record: games created because another user challenged this team.
-- This is intentionally separate from bp_lineup_stats so the main record remains
-- user-controlled while defensive performance can be surfaced later.
create or replace view public.bp_lineup_away_stats as
with away_matches as (
  select
    away_lineup_id as lineup_id,
    case when (final_score->>'away')::int > (final_score->>'home')::int then 1 else 0 end as win,
    case when (final_score->>'away')::int < (final_score->>'home')::int then 1 else 0 end as loss,
    case when (final_score->>'home')::int = (final_score->>'away')::int then 1 else 0 end as draw
  from public.bp_records
  where user_side = 'away'
    and source = 'public'  -- 친선/연습 매치는 원정/방어 전적 제외
    and home_lineup_id is not null
    and away_lineup_id is not null
)
select
  lineup_id,
  count(*)::int as matches,
  coalesce(sum(win), 0)::int as wins,
  coalesce(sum(loss), 0)::int as losses,
  coalesce(sum(draw), 0)::int as draws
from away_matches
group by lineup_id;

comment on view public.bp_lineup_away_stats is
  '팀 원정/방어 전적. 다른 유저가 내 팀을 상대로 실행한 경기(user_side=away)를 별도 집계한다.';
