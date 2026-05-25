-- BallPlay bp_predictions — 승리팀 예측 게임.
--
-- 기획:
--   - 사용자가 그날 scheduled 경기들의 승리팀을 직접 선택.
--   - 1게임 = 1예측, (user_id, game_id) unique.
--   - "예측 완료" 버튼 누르면 locked_at 설정 → 더 이상 수정 불가.
--   - in_progress/finished 경기는 예측 자체 불가 (UI에서 차단 + 서버 RLS에서도 차단하면 좋지만
--     game status는 비실시간이라 클라이언트만 차단해도 충분 — 보안 이슈 아님).
--   - 익명 로그인 사용자도 저장 허용 (bp_lineups/bp_records와 다름 — 미니게임 본질이 캐주얼).
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

-- ============================================================
-- 테이블
-- ============================================================
create table if not exists public.bp_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  predicted_winner_team_id text not null references public.teams(id),

  -- 날짜 인덱싱 편의 — games.game_date와 중복이지만 today 필터 조회를 한 테이블로 처리
  game_date date not null,

  -- 잠금 — null이면 편집 가능, timestamptz이면 잠긴 상태
  locked_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, game_id)
);

-- ============================================================
-- 인덱스 — 본인의 그날 예측 조회가 가장 빈번
-- ============================================================
create index if not exists bp_predictions_user_date_idx
  on public.bp_predictions (user_id, game_date desc);

-- 통계 조회용 (본인 전체 누적)
create index if not exists bp_predictions_user_idx
  on public.bp_predictions (user_id, locked_at)
  where locked_at is not null;

-- ============================================================
-- updated_at 자동 갱신 trigger
-- ============================================================
create or replace function public.bp_predictions_set_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists bp_predictions_updated_at on public.bp_predictions;
create trigger bp_predictions_updated_at
  before update on public.bp_predictions
  for each row execute function public.bp_predictions_set_updated_at();

-- ============================================================
-- 잠금 후 변경 차단 trigger — locked_at이 설정된 행은 predicted_winner 변경 불가.
--   단, locked_at 자체를 NULL로 되돌리는 것도 차단 (한 번 잠그면 영구).
-- ============================================================
create or replace function public.bp_predictions_immutable_when_locked()
returns trigger language plpgsql as $$
begin
  if OLD.locked_at is not null then
    if NEW.predicted_winner_team_id is distinct from OLD.predicted_winner_team_id then
      raise exception '잠긴 예측은 변경할 수 없습니다.';
    end if;
    if NEW.locked_at is null then
      raise exception '예측 잠금은 해제할 수 없습니다.';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists bp_predictions_lock_check on public.bp_predictions;
create trigger bp_predictions_lock_check
  before update on public.bp_predictions
  for each row execute function public.bp_predictions_immutable_when_locked();

-- ============================================================
-- RLS — 본인 행만 read/write. 익명 로그인도 허용.
-- ============================================================
alter table public.bp_predictions enable row level security;

drop policy if exists "bp_predictions_select_own" on public.bp_predictions;
create policy "bp_predictions_select_own"
on public.bp_predictions for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "bp_predictions_insert_own" on public.bp_predictions;
create policy "bp_predictions_insert_own"
on public.bp_predictions for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "bp_predictions_update_own" on public.bp_predictions;
create policy "bp_predictions_update_own"
on public.bp_predictions for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "bp_predictions_delete_own" on public.bp_predictions;
create policy "bp_predictions_delete_own"
on public.bp_predictions for delete
to authenticated
using (user_id = auth.uid());

-- ============================================================
-- 통계 view — 본인 예측의 적중/오답을 games join해서 판정.
--   결과:
--     - actual_winner_team_id: home_score > away_score면 home, 반대면 away, 동점이면 null
--     - is_correct: predicted_winner_team_id == actual_winner_team_id (둘 다 null 아니어야 함)
--     - is_judged: 경기가 finished + 동점 아님 (=승부가 갈린 상태)
--   동점·취소·진행중 경기는 is_judged=false → 통계에서 제외.
-- ============================================================
create or replace view public.bp_prediction_results
with (security_invoker = true) as
select
  p.id,
  p.user_id,
  p.game_id,
  p.game_date,
  p.predicted_winner_team_id,
  p.locked_at,
  g.status as game_status,
  g.home_team_id,
  g.away_team_id,
  g.home_score,
  g.away_score,
  case
    when g.status = 'finished' and g.home_score is not null and g.away_score is not null
         and g.home_score > g.away_score then g.home_team_id
    when g.status = 'finished' and g.home_score is not null and g.away_score is not null
         and g.away_score > g.home_score then g.away_team_id
    else null
  end as actual_winner_team_id,
  case
    when g.status = 'finished' and g.home_score is not null and g.away_score is not null
         and g.home_score <> g.away_score then true
    else false
  end as is_judged,
  case
    when g.status = 'finished' and g.home_score is not null and g.away_score is not null
         and g.home_score > g.away_score and p.predicted_winner_team_id = g.home_team_id then true
    when g.status = 'finished' and g.home_score is not null and g.away_score is not null
         and g.away_score > g.home_score and p.predicted_winner_team_id = g.away_team_id then true
    when g.status = 'finished' and g.home_score is not null and g.away_score is not null
         and g.home_score <> g.away_score then false
    else null
  end as is_correct
from public.bp_predictions p
join public.games g on g.id = p.game_id;

comment on view public.bp_prediction_results is
  '예측 + 실제 결과 조인 view. 판정 가능한 경기(is_judged=true)만 통계에 사용.';

comment on table public.bp_predictions is
  '승리팀 예측 게임 데이터. 1게임=1예측, locked_at 설정 후 변경 불가.';
