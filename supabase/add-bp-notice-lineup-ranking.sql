-- 야구놀이터 업데이트 공지 (2026-06-02) — 라인업 랭킹 기능 추가.
--   - 공개 매치에서 누적된 라인업 전적을 시즌·주간 단위로 집계해 랭킹으로 보여줍니다.
--   - 상위 3위는 골드/실버/브론즈 메달 표시.
--   - 랭킹 카드를 누르면 해당 라인업 미리보기로 이동.
--   - 진입: 홈 → "라인업 랭킹" 카드, 또는 /play/lineup/ranking 직링크.
--
-- 사전 조건: add-bp-notices.sql 가 실행되어 public.bp_notices 가 존재해야 함.
-- 본 SQL은 idempotent — 같은 제목 공지가 이미 있으면 재삽입하지 않음.
-- Supabase SQL Editor에서 1회 실행.

insert into public.bp_notices (title, body, published_at)
select
  '라인업 랭킹 기능 추가!',
  E'안녕하세요, 야구놀이터입니다 ⚾\n\n'
  || E'내가 짠 라인업이 다른 분들 라인업과 비교해 얼마나 잘 싸우고 있는지,\n'
  || E'한눈에 볼 수 있는 "라인업 랭킹"이 새로 열렸어요.\n\n'
  || E'🏆 시즌·주간 랭킹\n'
  || E'   공개 매치에서 쌓인 라인업 전적을 집계해 순위를 보여드립니다.\n\n'
  || E'🥇 상위 3위 메달\n'
  || E'   1·2·3위에는 골드/실버/브론즈 메달이 붙어요.\n\n'
  || E'👀 라인업 미리보기\n'
  || E'   랭킹 카드를 누르면 해당 라인업 구성을 그대로 확인할 수 있습니다.\n\n'
  || E'진입은 홈의 "라인업 랭킹" 카드, 또는 /play/lineup/ranking 경로로 바로 들어올 수 있어요.\n'
  || E'내 라인업을 공개 매치에 올려두고, 시즌 상위권에 도전해보세요!\n\n'
  || E'— 야구놀이터 드림',
  now()        -- published_at: 즉시 게시 (정렬 기준)
where not exists (
  select 1 from public.bp_notices
  where title = '라인업 랭킹 기능 추가!'
);

-- 확인용 — 게시 결과 조회
-- select id, title, published_at from public.bp_notices order by published_at desc;
