-- BallPlay 팀 은퇴(archive) 모델 (2026-06-06)
--
-- 배경:
--   팀 슬롯 모델로 전환하면서 "팀 삭제"를 두 갈래로 나눈다.
--     - 전적 0 (경기 안 한 팀): 그냥 하드 삭제 (보존할 게 없음).
--     - 전적 있는 팀: "은퇴" = 보관. 행을 지우지 않고 is_archived=true 로 표시.
--   은퇴 팀은:
--     - 활성 팀 목록/슬롯 한도/매치 풀에서 제외 (is_published=false 로 함께 내림).
--     - batting/pitching = 최종 라인업 스냅샷, created_at/archived_at, 그리고
--       bp_records 의 전적이 그대로 보존됨 → 추후 마이페이지/팀 히스토리에서 조회.
--   ※ 일반 "비공개 전환"과 달리 은퇴는 bp_records 를 삭제하지 않는다(전적 유지).
--
-- bp_ 접두사 격리 테이블이라 스키마 변경 허용 (공유 운영 테이블 아님).
-- Supabase SQL Editor 에서 1회 실행. idempotent.

alter table public.bp_lineups
  add column if not exists is_archived boolean not null default false;

alter table public.bp_lineups
  add column if not exists archived_at timestamptz;

comment on column public.bp_lineups.is_archived is
  '팀 은퇴 여부. true 면 활성 목록/슬롯 한도/매치 풀에서 제외하되 전적·스냅샷은 보존.';
comment on column public.bp_lineups.archived_at is
  '은퇴 시각. is_archived=true 로 전환될 때 기록.';

-- 활성 팀 조회 최적화 — 본인의 비은퇴 팀만 빠르게.
create index if not exists bp_lineups_active_idx
  on public.bp_lineups (owner_user_id) where is_archived = false;
