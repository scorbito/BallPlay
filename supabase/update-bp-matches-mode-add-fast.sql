-- BallPlay bp_matches.mode — 'fast' 모드 추가 + default 변경.
--
-- 변경:
--   - check 제약: ('normal','live') → ('fast','normal','live')
--   - default: 'live' → 'fast' (친구 매치 기본을 빠른 진행으로)
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

alter table public.bp_matches
  drop constraint if exists bp_matches_mode_check;

alter table public.bp_matches
  add constraint bp_matches_mode_check
  check (mode in ('fast', 'normal', 'live'));

alter table public.bp_matches
  alter column mode set default 'fast';

comment on column public.bp_matches.mode is
  '진행 모드 — fast(빠름, 기본) / normal(보통) / live(중계 호흡 + 단계 narration). 매치 생성 시 결정, 양쪽 클라이언트 sync 위해 고정.';
