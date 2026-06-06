-- BallPlay 플레이오프(가을야구) 솔로 PvE — 도전 1회 = 행 1개 (2026-06-06)
--
-- 설계(기획서 §0):
--   - 공식 전적과 분리: AI 상대 PvE라 bp_records/누적 전적에 집계하지 않고 여기에만 기록.
--   - MVP는 단일 테이블 + state jsonb (참가팀·라운드·경기결과 전부). 추후 통계 무거워지면 분리.
--   - RLS: 본인 것만 (공개 불필요).
--
-- bp_ 접두사 격리 테이블 — 공유 운영 테이블 아님. Supabase SQL Editor에서 1회 실행. idempotent.

create table if not exists public.bp_playoff_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  team_id       text not null,                       -- 내가 고른 구단
  team_name     text not null,                       -- 표시용(당시 팀명 보존)
  status        text not null default 'active'
                check (status in ('active','champion','eliminated','abandoned')),
  current_round int  not null default 1,             -- 1=4·5위전 2=준PO 3=PO 4=한국시리즈
  state         jsonb not null default '{}'::jsonb,  -- opponents/games/myLineup 등 진행 상태
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);

-- 본인 진행 중 run 조회 + 마이페이지 우승 집계용
create index if not exists bp_playoff_runs_user_status_idx
  on public.bp_playoff_runs (user_id, status);

-- updated_at 자동 갱신
create or replace function public.bp_playoff_runs_touch()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists bp_playoff_runs_touch_trg on public.bp_playoff_runs;
create trigger bp_playoff_runs_touch_trg
  before update on public.bp_playoff_runs
  for each row execute function public.bp_playoff_runs_touch();

-- ============================================================
-- RLS — 본인 것만 read/write (PvE라 공개 없음)
-- ============================================================
alter table public.bp_playoff_runs enable row level security;

drop policy if exists "bp_playoff_runs_owner" on public.bp_playoff_runs;
create policy "bp_playoff_runs_owner"
on public.bp_playoff_runs for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
