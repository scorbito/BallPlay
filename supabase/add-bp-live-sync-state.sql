-- 온디맨드 라이브 스코어 동기화 스로틀 상태.
--
-- 공개 엔드포인트 /api/games/live 가 이 시각을 보고, 마지막 KBO 동기화가 90초 이내면
-- 재조회를 생략한다. 여러 명이 동시에 봐도 KBO 호출은 날짜당 90초에 1번으로 제한.
-- service_role(admin 클라이언트)만 접근 — RLS on + 정책 없음 = anon 차단.

create table if not exists public.bp_live_sync_state (
  game_date  date primary key,
  synced_at  timestamptz not null default now()
);

alter table public.bp_live_sync_state enable row level security;
