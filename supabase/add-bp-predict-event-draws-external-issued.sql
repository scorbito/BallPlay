-- 쿠폰 '외부 지급 완료' 표시 — 사이트 쿠폰함 도입 이전에 카톡/이메일 등으로
-- 이미 쿠폰을 전달한 당첨자를 운영자 지급 패널에서 '완료'로 표시하기 위한 컬럼.
--   coupon_issued_external: 그 주 당첨자 중 외부로 지급 완료 처리한 user_id 문자열 배열.
--   실제 쿠폰함(bp_coupons)에는 넣지 않는다(깨진 이미지 방지) — 패널 표시용 마커.
--
-- Supabase SQL Editor 에서 1회 실행. idempotent.

alter table public.bp_predict_event_draws
  add column if not exists coupon_issued_external jsonb not null default '[]'::jsonb;

-- 예전 주차(가장 최근 추첨 주 제외) 당첨자 전원을 '외부 지급 완료'로 일괄 표시.
--   최신 주는 사이트 쿠폰함으로 직접 지급할 수 있게 미표시(pending) 유지.
update public.bp_predict_event_draws d
set coupon_issued_external =
  (case when d.winner_user_id is not null
        then jsonb_build_array(d.winner_user_id::text)
        else '[]'::jsonb end)
  || coalesce(
       (select jsonb_agg(cw->>'userId')
        from jsonb_array_elements(d.coupon_winners) cw
        where cw->>'userId' is not null),
       '[]'::jsonb)
where d.week_start_date < (select max(week_start_date) from public.bp_predict_event_draws);

notify pgrst, 'reload schema';

-- 확인용
-- select week_start_date, winner_nickname, coupon_issued_external from public.bp_predict_event_draws order by week_start_date desc;
