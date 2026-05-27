-- 야구놀이터 오픈 공지 — bp_notices에 첫 공지 삽입.
--
-- 사전 조건: add-bp-notices.sql 가 먼저 실행되어 public.bp_notices 테이블 + RLS 가 존재해야 함.
--   (아직 안 했다면 add-bp-notices.sql 먼저 실행 — idempotent라 중복 실행 안전)
--
-- 본 SQL은 idempotent — 같은 제목 공지가 이미 있으면 재삽입하지 않음.
-- Supabase SQL Editor에서 1회 실행.

insert into public.bp_notices (title, body, is_pinned, published_at)
select
  '🎉 야구놀이터 오픈! 환영합니다',
  E'안녕하세요, 야구놀이터입니다 ⚾\n\n'
  || E'KBO 팬들이 가볍게 즐기는 야구 놀이터가 문을 열었어요.\n\n'
  || E'⚾ 라인업 짜기 — 우리 팀 베스트 9를 직접 구성\n'
  || E'🏟️ 경기장 — 내 라인업으로 다른 사람과 가상 대결\n'
  || E'🎯 승부 예측 — 오늘 경기 승팀을 맞히고 적중률 경쟁\n'
  || E'🎬 야구 영상 — 짧고 재밌는 야구 콘텐츠\n\n'
  || E'지금은 오픈 베타예요. 무료로, 로그인 없이도 바로 즐길 수 있습니다.\n\n'
  || E'이용하면서 불편한 점이나 좋은 아이디어가 있으면 언제든 알려주세요.\n'
  || E'여러분의 의견으로 더 재밌는 놀이터를 만들어가겠습니다.\n\n'
  || E'오늘도 즐거운 야구 되세요! 🧡\n\n'
  || E'— 야구놀이터 드림',
  true,        -- is_pinned: 첫 공지라 상단 고정
  now()        -- published_at: 즉시 게시
where not exists (
  select 1 from public.bp_notices
  where title = '🎉 야구놀이터 오픈! 환영합니다'
);

-- 확인용 — 삽입 결과 조회
-- select id, title, is_pinned, published_at from public.bp_notices order by published_at desc;
