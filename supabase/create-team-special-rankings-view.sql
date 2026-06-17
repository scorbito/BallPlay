-- Create KBO Team Special Rankings View
--
-- This view aggregates team game stats (bp_team_game_stats) into 10 unique team rankings.
-- Execute this script in the Supabase SQL Editor.

create or replace view public.v_bp_team_special_rankings as
select
  team_id,
  count(id) as games_played,
  
  -- [공격] 1. 화력 발전소 (누적 루타수 합산)
  sum(total_bases) as total_bases,
  
  -- [공격] 2. 약속의 8회왕 (뒷심 득점 합산)
  sum(late_runs) as total_late_runs,
  
  -- [공격] 3. 작전 수행의 정석 (누적 희생번트+희생플라이 합산)
  sum(sacrifice_hits + sacrifice_flies) as total_sacrifice_hits_flies,
  
  -- [공격] 4. 지옥의 잔루 감옥 (경기당 평균 잔루수 = (안타+사사구-득점)/경기수)
  round(cast(sum(hits + walks + hbp - runs) as numeric) / count(id), 2) as avg_left_on_base,
  
  -- [주루] 5. 그라운드의 육상부 (누적 도루 성공 합산)
  sum(stolen_bases) as total_stolen_bases,
  
  -- [주루] 6. 그린라이트의 폭주 (누적 도루 실패 합산)
  sum(caught_stealing) as total_caught_stealing,
  
  -- [투수] 7. 삼진 폭격기 (누적 탈삼진 합산)
  sum(pitcher_strikeouts) as total_pitcher_strikeouts,
  
  -- [투수] 8. 짠물 마운드 (경기당 평균 자책점 = 자책점합산/경기수)
  round(cast(sum(pitcher_earned_runs) as numeric) / count(id), 2) as avg_earned_runs,
  
  -- [투수] 9. 공짜 출루 허용왕 (투수진 허용 볼넷+몸에맞는볼 합산)
  sum(pitcher_walks_hbp) as total_pitcher_walks_hbp,
  
  -- [수비] 10. 행복수비왕 (누적 실책 합산)
  sum(errors) as total_errors
from public.bp_team_game_stats
group by team_id;

-- Grant select permissions
grant select on public.v_bp_team_special_rankings to anon, authenticated;

comment on view public.v_bp_team_special_rankings is
  'Aggregated team-level rankings and statistics for KBO teams.';
