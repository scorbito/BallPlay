-- BallPlay 가을야구 명예의 전당 — 우승 1회 = 행 1개 (2026-06-06)
--
-- 설계:
--   - 전체 유저 공개 명예의 전당. 우승 시점의 닉네임/팀/라인업을 비정규화(박제)해서 저장.
--   - 우승 라인업(batting/pitching)은 run.state.myLineup 스냅샷을 그대로 jsonb로 보관.
--   - RLS: SELECT 는 모두 허용(공개), INSERT 는 본인만. UPDATE/DELETE 정책 없음(불변).
--
-- bp_ 접두사 격리 테이블 — 공유 운영 테이블 아님. Supabase SQL Editor에서 1회 실행. idempotent.

create table if not exists public.bp_playoff_champions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  nickname      text,                                  -- 우승 시점 닉네임 박제
  team_id       text not null,                         -- 우승 구단
  team_name     text not null,                         -- 우승 시점 팀명
  batting       jsonb,                                 -- 우승에 쓴 SavedLineup (없으면 null)
  pitching      jsonb,                                 -- 우승에 쓴 SavedPitcherLineup (없으면 null)
  run_id        uuid,                                  -- 어느 도전(run)에서 우승했는지
  completed_at  timestamptz,                           -- 우승 확정 시각
  created_at    timestamptz not null default now()
);

-- 최신순 정렬용
create index if not exists bp_playoff_champions_completed_at_idx
  on public.bp_playoff_champions (completed_at desc);

-- ============================================================
-- RLS — SELECT 공개 / INSERT 본인만 / UPDATE·DELETE 불가(불변)
-- ============================================================
alter table public.bp_playoff_champions enable row level security;

-- 공개 명예의 전당 — 누구나 조회 가능
drop policy if exists "bp_playoff_champions_select_all" on public.bp_playoff_champions;
create policy "bp_playoff_champions_select_all"
on public.bp_playoff_champions for select
using (true);

-- 우승 행 추가는 본인만
drop policy if exists "bp_playoff_champions_insert_self" on public.bp_playoff_champions;
create policy "bp_playoff_champions_insert_self"
on public.bp_playoff_champions for insert
to authenticated
with check (auth.uid() = user_id);

-- UPDATE / DELETE 정책 없음 → 불변(우승 기록은 수정/삭제 불가)
