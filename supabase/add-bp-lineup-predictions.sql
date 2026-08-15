-- BallPlay bp_lineup_predictions — 오늘의 라인업 예측 (미니게임)
--
-- 흐름:
--   1. 유저가 오늘 경기 중 한 팀을 골라 선발 9명과 타순을 예측 (하루 1팀)
--   2. 경기 시작 시각까지만 제출·수정 가능 (마감은 애플리케이션에서 판정)
--   3. 경기 종료 후 sync 가 bp_team_recent_lineups 를 채우면 그걸로 채점
--
-- 채점은 부분 점수다. 9명을 타순까지 전부 맞히는 건 사실상 불가능해서
-- "명단에 든 수(hit)"와 "타순까지 맞은 수(exact)"를 따로 센다.
--
-- 미니게임 격리 원칙에 따라 기존 테이블은 건드리지 않고 새 테이블만 추가한다.

create table if not exists public.bp_lineup_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  game_date date not null,
  -- 예측 대상 팀. 한 경기에서 홈/원정 중 하나만 고른다.
  team_id text not null,

  -- [{ "order": 1, "name": "홍창기", "rosterId": "lg-51" }, ...] 9개.
  -- bp_team_recent_lineups.batting 과 같은 형태로 맞춰 채점 로직을 단순하게 유지한다.
  picks jsonb not null,

  -- ── 채점 결과 (경기 종료 후 채워짐) ──
  hit_count smallint,    -- 실제 선발 9인에 포함된 수 (타순 무관, 0~9)
  exact_count smallint,  -- 타순까지 일치한 수 (0~9)
  scored_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 하루 1팀. 같은 날 다른 경기로 갈아타는 건 삭제 후 재생성으로 처리한다.
  unique (user_id, game_date)
);

create index if not exists bp_lineup_predictions_game_idx
  on public.bp_lineup_predictions (game_id);

-- 채점 배치가 "아직 채점 안 된 지난 예측"을 훑는 경로.
create index if not exists bp_lineup_predictions_unscored_idx
  on public.bp_lineup_predictions (game_date)
  where scored_at is null;

-- ============================================================
-- RLS
-- ============================================================
alter table public.bp_lineup_predictions enable row level security;

-- 집계·랭킹을 위해 조회는 열어둔다 (picks 자체가 민감정보는 아니다).
drop policy if exists "bp_lineup_predictions_read" on public.bp_lineup_predictions;
create policy "bp_lineup_predictions_read"
on public.bp_lineup_predictions for select
to anon, authenticated
using (true);

drop policy if exists "bp_lineup_predictions_insert" on public.bp_lineup_predictions;
create policy "bp_lineup_predictions_insert"
on public.bp_lineup_predictions for insert
to anon, authenticated
with check (auth.uid() = user_id);

-- 마감 전 수정 허용. 마감 시각 판정은 games.game_time 을 보는 애플리케이션 쪽에서 한다.
-- 채점 컬럼까지 유저가 고칠 수 있으므로, 채점은 service role 로만 수행하고
-- 이미 채점된 행(scored_at is not null)은 수정 대상에서 뺀다.
drop policy if exists "bp_lineup_predictions_update" on public.bp_lineup_predictions;
create policy "bp_lineup_predictions_update"
on public.bp_lineup_predictions for update
to anon, authenticated
using (auth.uid() = user_id and scored_at is null)
with check (auth.uid() = user_id);

drop policy if exists "bp_lineup_predictions_delete" on public.bp_lineup_predictions;
create policy "bp_lineup_predictions_delete"
on public.bp_lineup_predictions for delete
to anon, authenticated
using (auth.uid() = user_id and scored_at is null);

comment on table public.bp_lineup_predictions is
  '오늘의 라인업 예측. 하루 1팀, 선발 9명과 타순을 맞히면 경기 후 부분 점수로 채점.';
