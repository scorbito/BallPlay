-- 예측왕(메인 당첨자)의 예측 경기수·적중률을 추첨 기록에 저장.
--   당첨자 발표 페이지에서 "N경기 참여 · M% 적중"을 하드코딩 없이 표시하기 위함.
--   winner_rate 는 0~1 (qualifier.rate 와 동일 단위). 표시 시 ×100.
--
-- Supabase SQL Editor 에서 1회 실행. idempotent.

alter table public.bp_predict_event_draws
  add column if not exists winner_total int,
  add column if not exists winner_correct int,
  add column if not exists winner_rate numeric;  -- 0~1

-- 1주차(7/21~7/26) 백필: 30경기 참여 · 56% 적중 (공지 발표값과 일치)
update public.bp_predict_event_draws
set winner_total = 30,
    winner_correct = 17,
    winner_rate = 0.56
where week_start_date = '2026-07-21';

notify pgrst, 'reload schema';

-- 확인용
-- select week_start_date, winner_nickname, winner_total, winner_rate from public.bp_predict_event_draws order by week_start_date desc;
