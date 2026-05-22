-- BallPlay 실시간 매치업 (bp_matches)
-- 기획: docs/product-spec.md §6.3 / §10 v2 / §14 후속 (실시간 동시 시청)
-- 개발 노트: docs/sim-engine-spec.md §7 (시드 결정성 기반)
--
-- 두 사용자가 같은 시점에 같은 시뮬 결과를 동시 시청하기 위한 매치업 테이블.
-- 시뮬 자체는 클라이언트가 결정론 엔진으로 각자 돌리고, 서버는 매치 셋업 +
-- start_at 동기화 + Realtime broadcast만 담당.
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

-- ============================================================
-- 1. updated_at 자동 갱신 트리거 (없으면 생성)
-- ============================================================
do $$ begin
  create or replace function public.handle_updated_at()
  returns trigger language plpgsql as $func$
  begin
    new.updated_at = now();
    return new;
  end;
  $func$;
exception when others then null; end $$;

-- ============================================================
-- 2. bp_matches 테이블
-- ============================================================
create table if not exists public.bp_matches (
  id uuid primary key default gen_random_uuid(),

  -- 단축 초대 코드 (URL: /stadium/live/{invite_code})
  invite_code text unique,

  -- 매치 상태머신
  --   pending   : 생성자만 라인업 등록, 상대방 대기
  --   ready     : 양쪽 라인업 등록 완료, start_at 결정 대기
  --   playing   : start_at 설정됨, 양쪽 클라이언트가 동시 시뮬 진행
  --   finished  : 시뮬 종료
  --   cancelled : 누군가 취소
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'playing', 'finished', 'cancelled')),

  -- 양쪽 팀 (away=초공격, home=말공격)
  away_team_id text,
  home_team_id text,
  -- 라인업 스냅샷 (매치 시점에 동결, share token과 동일 구조)
  away_lineup_snapshot jsonb,
  home_lineup_snapshot jsonb,

  -- 슬롯 점유자 — 정식 user면 auth.uid(), 익명/게스트는 guest_id 사용
  away_owner_id uuid,
  home_owner_id uuid,
  away_guest_id text,
  home_guest_id text,

  -- 시뮬 결정성 (모두 일치해야 같은 결과)
  seed bigint not null,
  engine_version text not null,
  stats_snapshot_date text not null,

  -- 타이밍
  start_at timestamptz,         -- 양쪽 ready 후 서버가 결정 (now + 3초 등 카운트다운)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bp_matches_invite_code_idx
  on public.bp_matches(invite_code);
create index if not exists bp_matches_status_idx
  on public.bp_matches(status);
create index if not exists bp_matches_created_at_idx
  on public.bp_matches(created_at desc);

-- updated_at 트리거
drop trigger if exists bp_matches_updated_at on public.bp_matches;
create trigger bp_matches_updated_at
  before update on public.bp_matches
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 3. Realtime publication 등록
--    클라이언트가 supabase.channel(`match:${id}`).on('postgres_changes', ...)으로 구독
-- ============================================================
do $$ begin
  alter publication supabase_realtime add table public.bp_matches;
exception when duplicate_object then null; end $$;

-- ============================================================
-- 4. invite_code 자동 생성 함수 (6자 영숫자, 충돌 시 재시도)
-- ============================================================
create or replace function public.generate_bp_match_invite_code()
returns text language plpgsql as $$
declare
  candidate text;
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- I/O/0/1 제외 (혼동 방지)
  i int;
  exists_count int;
begin
  for attempt in 1..10 loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    select count(*) into exists_count from public.bp_matches where invite_code = candidate;
    if exists_count = 0 then
      return candidate;
    end if;
  end loop;
  -- 10회 시도 후에도 충돌 (확률 ~0) → UUID 일부로 폴백
  return upper(substr(gen_random_uuid()::text, 1, 6));
end;
$$;

-- ============================================================
-- 5. RLS — v1엔 단순 정책. invite_code 모르면 row 조회 안 됨 (조회 자체는 누구나).
--    v2에서 더 세분화 가능 (예: 본인 소유 매치만 update 등).
-- ============================================================
alter table public.bp_matches enable row level security;

-- read: 모두 허용 (invite_code로 찾아야만 의미 있음)
drop policy if exists "bp_matches_select" on public.bp_matches;
create policy "bp_matches_select"
on public.bp_matches for select
using (true);

-- insert: 인증/익명 사용자 누구나 매치 생성 가능
drop policy if exists "bp_matches_insert" on public.bp_matches;
create policy "bp_matches_insert"
on public.bp_matches for insert
to authenticated
with check (true);

-- update: 자기 슬롯(owner_id 또는 guest_id 일치)만
-- 게스트는 클라이언트에서 guest_id를 RPC 파라미터로 넘겨야 함 (RLS만으론 검증 한계 — v2 강화)
drop policy if exists "bp_matches_update" on public.bp_matches;
create policy "bp_matches_update"
on public.bp_matches for update
to authenticated
using (
  -- 본인이 한쪽 슬롯의 owner인 경우만
  (auth.uid() is not null and (away_owner_id = auth.uid() or home_owner_id = auth.uid()))
  -- 빈 슬롯(상대 자리)에 join하는 경우도 update이므로 허용
  or (away_owner_id is null and home_owner_id is null)
  or (away_owner_id is null and home_owner_id = auth.uid())
  or (home_owner_id is null and away_owner_id = auth.uid())
);

-- ============================================================
-- 6. 관리자 검토용 view (선택, 디버깅 편의)
-- ============================================================
create or replace view public.bp_matches_summary as
select
  id,
  invite_code,
  status,
  away_team_id,
  home_team_id,
  case when away_lineup_snapshot is not null then 'set' else 'empty' end as away_lineup,
  case when home_lineup_snapshot is not null then 'set' else 'empty' end as home_lineup,
  seed,
  engine_version,
  stats_snapshot_date,
  start_at,
  created_at,
  updated_at
from public.bp_matches
order by created_at desc;

comment on table public.bp_matches is 'BallPlay 실시간 매치업 — 두 사용자가 같은 시뮬을 동시 시청하기 위한 매치 셋업/동기화 row';
comment on column public.bp_matches.start_at is '양쪽 ready 후 서버가 결정한 시뮬 시작 시각. 클라이언트는 이 시각에 동시 시뮬 시작.';
comment on column public.bp_matches.seed is '시뮬 시드 — 양쪽이 같은 seed로 같은 결과 시뮬';
