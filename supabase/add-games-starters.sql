-- BallPlay — games 테이블에 선발 투수 컬럼 추가.
-- 승부 예측 화면에서 "선발: A vs B" 표시 용도. KBO API 응답에서 같이 들어오는 값 캐싱.
--
-- 필드:
--   - home_starter / away_starter: 선발 투수 이름 (text). KBO 미발표 시 null.
--   - starter_fetched_at: 마지막 fetch 시각. throttle 판정에 사용
--                          (페이지 진입 시 N분 이내 재호출 차단).
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

alter table public.games
  add column if not exists home_starter text,
  add column if not exists away_starter text,
  add column if not exists starter_fetched_at timestamptz;

-- 오늘 경기 throttle 판정 인덱스 — game_date + starter_fetched_at 조회 가속
create index if not exists games_starter_fetched_idx
  on public.games (game_date, starter_fetched_at);
