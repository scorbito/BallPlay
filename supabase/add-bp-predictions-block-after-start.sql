-- BallPlay bp_predictions — 경기 시작 후 예측 차단 (서버 측 강제).
--
-- 배경:
--   클라이언트(WinnerPredictScreen)에서 경기 시작 시각이 지나면 예측/잠금을 막지만,
--   API를 직접 조작하면 우회 가능. 경품 이벤트라 서버(DB) 측에서도 강제한다.
--   DB now()(서버 시각)로 판정하므로 클라이언트 시계 조작·직접 PostgREST 호출 모두 차단.
--
-- 규칙:
--   - INSERT 또는 predicted_winner_team_id 변경(UPDATE) 시 경기 시작 시각(KST)을 조회,
--     now() >= 시작이면 예외.
--   - locked_at만 바뀌는 UPDATE(예측 잠금)는 시작 후라도 허용 — 시작 전에 한 픽의 마무리.
--   - games.game_time이 없으면 시작 시각 판단 불가 → 통과(클라이언트 status 차단에 위임).
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

create or replace function public.bp_predictions_block_after_start()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start timestamptz;
begin
  -- 잠금(locked_at)만 바뀌는 UPDATE는 시작 후라도 허용 — 픽 자체는 그대로.
  if TG_OP = 'UPDATE'
     and NEW.predicted_winner_team_id is not distinct from OLD.predicted_winner_team_id then
    return NEW;
  end if;

  -- 경기 시작 시각(KST). game_time이 null이면 행이 안 잡혀 v_start = null → 통과.
  select (g.game_date + g.game_time) at time zone 'Asia/Seoul'
    into v_start
  from public.games g
  where g.id = NEW.game_id
    and g.game_time is not null;

  if v_start is not null and now() >= v_start then
    raise exception '경기가 시작되어 예측할 수 없습니다.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists bp_predictions_block_start on public.bp_predictions;
create trigger bp_predictions_block_start
  before insert or update on public.bp_predictions
  for each row execute function public.bp_predictions_block_after_start();

comment on function public.bp_predictions_block_after_start() is
  '경기 시작 시각(KST)이 지난 경기의 예측 생성·변경을 차단. 잠금(locked_at)만 변경은 허용.';
