-- BallPlay bp_predictions — "선택 = 예측 확정" 모델로 전환.
--
-- 배경:
--   기존: 팀 선택(draft) → "예측 완료" 버튼 → locked_at 설정 → 집계 대상.
--         완료를 안 누르면 예측이 안 돼서, 예측한 줄 알았는데 누락되는 사용자가 많았음.
--   변경: 팀 선택 즉시 locked_at 을 찍어 바로 집계 대상이 됨.
--         수정/취소는 '경기 시작 전'까지 자유롭게 가능, 경기 시작 시 자동으로 잠김.
--
-- 즉 "잠금 = 수정 불가" 기준이 locked_at → '경기 시작 시각'으로 바뀐다.
--   (locked_at 은 이제 '예측 확정 시각' 의미로만 남고, 집계 필터로 계속 사용됨 →
--    적중률/랭킹/이벤트/BP 집계 로직은 전혀 바꾸지 않아도 된다.)
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

-- ============================================================
-- 1) 기존 "잠기면 변경 금지" 트리거 제거
--    locked_at 이 선택 즉시 찍히므로, 이 트리거가 있으면 픽 변경/취소가 전부 막힌다.
--    변경 불가 시점은 아래 (2) 경기 시작 트리거가 담당한다.
-- ============================================================
drop trigger if exists bp_predictions_lock_check on public.bp_predictions;
drop function if exists public.bp_predictions_immutable_when_locked();

-- ============================================================
-- 2) 경기 시작 후 차단 트리거 — INSERT/UPDATE 에 더해 DELETE 까지 차단.
--    DELETE 를 막지 않으면 경기 시작 후 '틀린 예측 지우기'로 적중률을 조작할 수 있다.
-- ============================================================
create or replace function public.bp_predictions_block_after_start()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game_id uuid;
  v_start timestamptz;
begin
  v_game_id := case when TG_OP = 'DELETE' then OLD.game_id else NEW.game_id end;

  -- 경기 시작 시각(KST). game_time 이 null 이면 판단 불가 → 통과.
  select (g.game_date + g.game_time) at time zone 'Asia/Seoul'
    into v_start
  from public.games g
  where g.id = v_game_id
    and g.game_time is not null;

  if v_start is not null and now() >= v_start then
    if TG_OP = 'DELETE' then
      raise exception '경기가 시작되어 예측을 취소할 수 없습니다.';
    else
      raise exception '경기가 시작되어 예측할 수 없습니다.';
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

drop trigger if exists bp_predictions_block_start on public.bp_predictions;
create trigger bp_predictions_block_start
  before insert or update or delete on public.bp_predictions
  for each row execute function public.bp_predictions_block_after_start();

comment on function public.bp_predictions_block_after_start() is
  '경기 시작 시각(KST) 이후의 예측 생성·변경·취소를 차단. 경기 시작 = 자동 잠금.';

-- ============================================================
-- 3) 기존 draft(locked_at is null) 보정 — '아직 시작 안 한 경기'만 확정 처리.
--    새 모델에선 선택 = 확정이므로, 이미 골라둔 픽이 누락되지 않게 맞춰준다.
--    ⚠ 이미 시작/종료된 과거 경기의 draft 는 건드리지 않는다
--       (과거 적중률·랭킹·이벤트 집계가 소급 변경되는 것을 방지).
-- ============================================================
update public.bp_predictions p
set locked_at = now()
from public.games g
where g.id = p.game_id
  and p.locked_at is null
  and g.game_time is not null
  and now() < (g.game_date + g.game_time) at time zone 'Asia/Seoul';
