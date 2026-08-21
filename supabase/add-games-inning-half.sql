-- 진행 중 경기의 초(top)/말(bottom) 표시용 컬럼.
--
-- KBO API 의 GAME_TB_SC("T"/"B")를 저장해 "7회말" 처럼 표시한다. 예정·종료엔 null.
-- games 는 공유 테이블이지만 additive nullable 컬럼이라 기존 앱에 영향 없음.
-- 멱등: add column if not exists.

alter table public.games
  add column if not exists inning_half text;
