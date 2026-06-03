-- BallPlay — 계정 누적 전적 카운터 테이블.
-- 목적: 본인이 직접 플레이한 경기만 카운트되는 "계정 단위" 누적 전적 분리.
-- 배경: 기존엔 bp_records 전체를 집계 → mirror-bp-records-for-opponent.sql 의 mirror row 까지
--      포함돼 "자고 일어났더니 1패" 같은 현상 발생. 라인업 랭킹은 mirror 포함이 의도이므로
--      라인업 쿼리는 그대로 두고, 계정 누적만 별도 카운터 테이블로 분리한다.
--
-- 작성 의도:
--   - 트리거로 bp_records INSERT 시점에 OWNER 본인 측에만 +1.
--   - mirror trigger 가 set_config('bp.mirror_in_progress', 'true', true) 설정 후 mirror row 를
--     INSERT 하므로, 이 트리거는 해당 세션 변수를 보고 mirror INSERT 는 skip 한다.
--   - 트리거 실행 순서: PostgreSQL 은 동일 이벤트의 트리거를 이름 알파벳 순으로 실행.
--     mirror trigger 가 먼저 실행돼 mirror row 를 INSERT 하면, mirror row INSERT 시점에는
--     이미 'bp.mirror_in_progress' = 'true' 인 상태로 본 트리거가 발동 → skip.
--     명확히 뒤에서 실행되도록 본 트리거 이름을 'z_' 접두로 지정한다.
--   - SECURITY DEFINER + RLS: 카운터 테이블은 INSERT/UPDATE 정책 없음 → 클라이언트 직접 변경 차단.
--     트리거 함수가 SECURITY DEFINER 로 RLS 우회 UPSERT.
--   - 백필 안 함: 모든 user 0/0/0 새 시작. 첫 매치 때 UPSERT 로 row 생성.
--   - 무승부도 wins/losses 별도로 카운트(draws). 기존 랭킹 규칙(무승부 제외)은 호출처에서 처리.
--
-- 본 SQL 은 idempotent — Supabase SQL Editor 에서 1회 실행하면 됨.

-- ============================================================
-- 1) 테이블
-- ============================================================
create table if not exists public.bp_account_stats (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  wins       int not null default 0,
  losses     int not null default 0,
  draws      int not null default 0,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2) RLS
-- ============================================================
-- 랭킹 페이지에서 anon/authenticated 모두 다른 사람 stats 도 SELECT 가능해야 함.
-- INSERT/UPDATE/DELETE 정책은 만들지 않음 → 클라이언트 직접 변경 차단.
-- 트리거 함수(SECURITY DEFINER) 만 UPSERT 가능.
alter table public.bp_account_stats enable row level security;

drop policy if exists "bp_account_stats select all" on public.bp_account_stats;
create policy "bp_account_stats select all"
  on public.bp_account_stats
  for select
  to anon, authenticated
  using (true);

-- ============================================================
-- 3) 트리거 함수
-- ============================================================
create or replace function public.bp_account_stats_increment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_score int;
  opp_score  int;
  delta_w    int := 0;
  delta_l    int := 0;
  delta_d    int := 0;
begin
  -- 정식 매치만 카운트 (라운드/연습 등은 제외)
  if NEW.source <> 'public' then
    return NEW;
  end if;

  -- mirror trigger 가 만든 row 는 skip — 본인이 직접 플레이한 경기만 카운트.
  if coalesce(current_setting('bp.mirror_in_progress', true), '') = 'true' then
    return NEW;
  end if;

  -- 결과 없음(중도 종료 등) → skip
  if NEW.final_score is null or NEW.owner_user_id is null then
    return NEW;
  end if;

  if NEW.user_side = 'home' then
    user_score := (NEW.final_score->>'home')::int;
    opp_score  := (NEW.final_score->>'away')::int;
  else
    user_score := (NEW.final_score->>'away')::int;
    opp_score  := (NEW.final_score->>'home')::int;
  end if;

  if user_score is null or opp_score is null then
    return NEW;
  end if;

  if user_score > opp_score then
    delta_w := 1;
  elsif user_score < opp_score then
    delta_l := 1;
  else
    delta_d := 1;
  end if;

  insert into public.bp_account_stats (user_id, wins, losses, draws, updated_at)
  values (NEW.owner_user_id, delta_w, delta_l, delta_d, now())
  on conflict (user_id) do update
    set wins       = public.bp_account_stats.wins   + excluded.wins,
        losses     = public.bp_account_stats.losses + excluded.losses,
        draws      = public.bp_account_stats.draws  + excluded.draws,
        updated_at = now();

  return NEW;
end;
$$;

-- ============================================================
-- 4) 트리거 등록
-- ============================================================
-- 이름 앞에 'z_' 를 붙여 mirror trigger ('bp_records_mirror_trigger') 보다
-- 뒤에 실행되도록 보장 → mirror row INSERT 시점에 'bp.mirror_in_progress'='true' 가
-- 본 트리거에서 정확히 감지됨.
drop trigger if exists z_bp_account_stats_after_mirror_trigger on public.bp_records;
create trigger z_bp_account_stats_after_mirror_trigger
  after insert on public.bp_records
  for each row execute function public.bp_account_stats_increment();

-- ============================================================
-- 확인용 쿼리
-- ============================================================
-- 트리거 순서 확인 (이름 알파벳 순):
-- select tgname from pg_trigger
-- where tgrelid = 'public.bp_records'::regclass
--   and not tgisinternal
-- order by tgname;
--
-- 누적 stats 확인:
-- select * from public.bp_account_stats order by wins desc, losses asc limit 20;
