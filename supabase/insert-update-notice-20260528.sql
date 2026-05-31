-- 야구놀이터 업데이트 공지 (2026-05-28)
--   - 오픈 이후 추가된 큰 기능들 안내: AI 승리팀 예측, 야구 뉴스, 경기장 사운드, 실제 라인업 불러오기.
--   - 정렬 정책: published_at desc 단일 정렬 (고정 핀 기능 제거됨).
--     기존 오픈 환영 공지의 is_pinned=true 도 더 이상 영향 없음 — 게시 시각 순.
--
-- 사전 조건: add-bp-notices.sql 가 실행되어 public.bp_notices 가 존재해야 함.
-- 본 SQL은 idempotent — 같은 제목 공지가 이미 있으면 재삽입하지 않음.
-- Supabase SQL Editor에서 1회 실행.

-- 제목에 이모지(🆕) 대신 코드 단의 NEW 뱃지(.notice-new)로 시인성 처리 — 게시 후 7일간 자동 표시.
insert into public.bp_notices (title, body, published_at)
select
  '새 기능 업데이트 — AI 승리팀 예측 + 야구 뉴스',
  E'안녕하세요, 야구놀이터입니다 ⚾\n\n'
  || E'오픈 이후 새로 추가된 기능들을 안내드려요!\n\n'
  || E'🤖 AI 승리팀 예측\n'
  || E'   매일 오늘의 KBO 경기를 AI가 분석해 승리 예상팀과 한줄 코멘트를 제공합니다.\n'
  || E'   홈 화면에서 바로 확인하세요.\n\n'
  || E'📰 KBO 야구 뉴스\n'
  || E'   최신 프로야구 뉴스를 한곳에 모았어요. 팀별 필터로 우리 팀 기사만 골라보기도 가능합니다.\n\n'
  || E'🔊 경기장 사운드\n'
  || E'   경기 효과음 3종과 배경음악이 추가됐어요. 더 몰입감 있게 즐겨보세요. (음소거 토글 가능)\n\n'
  || E'⚾ 실제 경기 라인업 불러오기\n'
  || E'   오늘의 KBO 경기 라인업을 그대로 불러와 시뮬레이션 할 수 있습니다.\n\n'
  || E'앞으로도 꾸준히 새 기능과 콘텐츠를 더해가겠습니다.\n'
  || E'재밌게 즐겨주시고, 의견은 언제든 환영이에요!\n\n'
  || E'— 야구놀이터 드림',
  now()        -- published_at: 즉시 게시 (정렬 기준)
where not exists (
  select 1 from public.bp_notices
  where title in (
    '새 기능 업데이트 — AI 승리팀 예측 + 야구 뉴스',
    '🆕 새 기능 업데이트 — AI 승리팀 예측 + 야구 뉴스'  -- 이전 제목(이모지 포함) 호환
  )
);

-- 이미 이모지 포함 제목으로 들어간 공지가 있으면 제목만 정리.
update public.bp_notices
   set title = '새 기능 업데이트 — AI 승리팀 예측 + 야구 뉴스'
 where title = '🆕 새 기능 업데이트 — AI 승리팀 예측 + 야구 뉴스';

-- 확인용 — 게시 결과 조회
-- select id, title, published_at from public.bp_notices order by published_at desc;
