-- BallPlay bp_ai_battle_votes — AI 배틀 투표 테이블
--
-- 흐름:
--   1. 유저가 홈/원정팀 주장 중 하나를 선택해 투표
--   2. 익명 계정 포함 1인 1투표 (unique game_id + user_id)
--   3. 투표 집계는 count(voted_side) 로 조회
--

create table if not exists public.bp_ai_battle_votes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  voted_side text not null check (voted_side in ('home', 'away')),
  created_at timestamptz not null default now(),
  unique (game_id, user_id)
);

create index if not exists bp_ai_battle_votes_game_id_idx
  on public.bp_ai_battle_votes (game_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.bp_ai_battle_votes enable row level security;

-- 누구나 집계 조회 가능
drop policy if exists "bp_ai_battle_votes_read" on public.bp_ai_battle_votes;
create policy "bp_ai_battle_votes_read"
on public.bp_ai_battle_votes for select
to anon, authenticated
using (true);

-- 본인 투표만 insert 가능
drop policy if exists "bp_ai_battle_votes_insert" on public.bp_ai_battle_votes;
create policy "bp_ai_battle_votes_insert"
on public.bp_ai_battle_votes for insert
to anon, authenticated
with check (auth.uid() = user_id);

comment on table public.bp_ai_battle_votes is
  'AI 편파 배틀 투표. 게임당 유저 1표, 홈/원정 주장 지지 선택.';
