-- 이벤트 당첨자 "확정→공개" 게이팅용 컬럼.
--
-- 추첨(drawWeeklyEventWinnerAction/drawCouponWinnersAction)은 이제 published_at 을 null 로 두고,
-- 관리자가 "당첨자 확정"을 눌러야 published_at 이 채워진다. 공개 페이지(/event/winners·명예의 전당·
-- 홈 스트립·latest-winners API)는 published_at is not null 인 주만 노출한다.
-- 멱등: add column if not exists.

alter table public.bp_predict_event_draws
  add column if not exists published_at timestamptz;
