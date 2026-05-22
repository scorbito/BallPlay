-- BallPlay bp_matches.mode 컬럼 추가 — 친구 대결 진행 모드.
-- 매치 생성자가 일반/중계 모드를 선택, 양쪽 클라이언트 동일 모드로 진행 (sync 보장).
-- 'fast'는 동시 시청에 부적합해서 제외.
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

alter table public.bp_matches
  add column if not exists mode text not null default 'live'
  check (mode in ('normal', 'live'));

comment on column public.bp_matches.mode is
  '진행 모드 — normal(빠른 호흡) 또는 live(중계 호흡 + 단계 narration). 매치 생성 시 결정, 양쪽 클라이언트 sync 위해 고정.';
