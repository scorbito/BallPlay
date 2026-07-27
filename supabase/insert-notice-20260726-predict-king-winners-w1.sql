-- 주간 예측왕 이벤트 1주차(7/21~7/26) 당첨자 발표 공지
--
-- 사전 조건: public.bp_notices 존재. idempotent(같은 제목 있으면 재삽입 안 함).
-- Supabase SQL Editor에서 1회 실행. published_at = now() → 실행 즉시 게시.
-- (게시 시각 조절하려면 now() 를 원하는 값으로 변경)
--
-- ⚠️ 당첨자 연락처(이메일/휴대폰)는 공지에 노출하지 않는다(개인정보). 닉네임만.

insert into public.bp_notices (title, body, published_at)
select
  '🎉 주간 예측왕 1주차 당첨자 발표 (7/21~7/26)',
  E'안녕하세요, 야구놀이터입니다.\n\n'
  || E'주간 예측왕 이벤트 첫 주(7/21~7/26) 당첨자를 발표합니다.\n'
  || E'참여해주신 모든 분께 감사드려요!\n\n'
  || E'🏆 예측왕 (뿌링클 콤보)\n'
  || E'   - 철벽내야수9b9 님 (30경기 참여 · 56% 적중)\n\n'
  || E'🎟 참여상 (메가커피 5,000원 쿠폰)\n'
  || E'   - hsas 님\n'
  || E'   - 초신성야빠b5b 님\n'
  || E'   - 용감한직관러537 님\n\n'
  || E'🎟 쿠폰 전달 안내\n'
  || E'   - 쿠폰은 늦어도 이번 주 수요일 전까지 설정 > 내 쿠폰함으로 보내드립니다.\n'
  || E'   - 도착하면 홈 알림과 설정 탭 배지로 알려드려요.\n'
  || E'   - 내 쿠폰함에서 언제든 확인하고 이미지로 저장할 수 있어요.\n\n'
  || E'다음 주도 많은 참여 부탁드립니다. 감사합니다!\n\n'
  || E'— 야구놀이터 드림',
  now()
where not exists (
  select 1 from public.bp_notices
  where title = '🎉 주간 예측왕 1주차 당첨자 발표 (7/21~7/26)'
);

-- 확인용
-- select id, title, published_at from public.bp_notices order by published_at desc;
