-- BallPlay 라인업 DB 동기화 (bp_lineups)
-- 기획: docs/product-spec.md §10 (무료 로그인 사용자 = 다기기 동기화)
--
-- 사용 모델:
--   - 비로그인: localStorage("ballplay:my-lineups")만 사용
--   - 로그인: localStorage(캐시) + bp_lineups(source of truth)
--   - 첫 로그인 시 localStorage 라인업이 있으면 자동 DB 업로드
--   - 변경 시 양쪽 모두 write
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
-- 2. bp_lineups 테이블
-- ============================================================
create table if not exists public.bp_lineups (
  id uuid primary key default gen_random_uuid(),

  -- 소유자 (auth.users 참조)
  owner_user_id uuid not null references auth.users(id) on delete cascade,

  -- 클라이언트 생성 entryId (localStorage에서 사용하는 UUID).
  -- DB의 id와는 별개 — entryId는 클라이언트가 idempotent upsert에 사용.
  entry_id text not null,

  -- 사용자 지정 팀명 (= LineupEntry.name = SharedTeam.n = displayName)
  name text not null,

  -- KBO 팀 코드 (선수 풀)
  team_id text not null,

  -- 타순 + DH (jsonb). 스키마: SavedLineup
  batting jsonb not null,

  -- 투수 라인업 (선택, jsonb). 스키마: SavedPitcherLineup. null이면 자동 보강.
  pitching jsonb,

  -- 공개 풀 매칭용 (PR2에서 사용, 지금은 false 디폴트)
  is_published boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 한 사용자가 같은 entryId 중복 보유 불가 (upsert 기준)
  unique (owner_user_id, entry_id)
);

create index if not exists bp_lineups_owner_idx
  on public.bp_lineups(owner_user_id);
create index if not exists bp_lineups_updated_idx
  on public.bp_lineups(updated_at desc);
create index if not exists bp_lineups_published_idx
  on public.bp_lineups(is_published) where is_published = true;

-- updated_at 트리거
drop trigger if exists bp_lineups_updated_at on public.bp_lineups;
create trigger bp_lineups_updated_at
  before update on public.bp_lineups
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 3. RLS — PR1은 본인 row만 read/write.
--    PR2에서 "is_published=true인 row는 모두 read" 정책 추가 예정.
-- ============================================================
alter table public.bp_lineups enable row level security;

-- select: 본인 row만 (PR2에서 공개 row 허용 정책 추가)
drop policy if exists "bp_lineups_select" on public.bp_lineups;
create policy "bp_lineups_select"
on public.bp_lineups for select
to authenticated
using (owner_user_id = auth.uid());

-- insert: 본인 owner_user_id로만
drop policy if exists "bp_lineups_insert" on public.bp_lineups;
create policy "bp_lineups_insert"
on public.bp_lineups for insert
to authenticated
with check (owner_user_id = auth.uid());

-- update: 본인 row만 + owner_user_id 변경 금지
drop policy if exists "bp_lineups_update" on public.bp_lineups;
create policy "bp_lineups_update"
on public.bp_lineups for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

-- delete: 본인 row만
drop policy if exists "bp_lineups_delete" on public.bp_lineups;
create policy "bp_lineups_delete"
on public.bp_lineups for delete
to authenticated
using (owner_user_id = auth.uid());

-- ============================================================
-- 4. 코멘트
-- ============================================================
comment on table public.bp_lineups is
  'BallPlay 라인업 슬롯 — 로그인 사용자의 다기기 동기화 및 공개 매칭 풀(PR2)';
comment on column public.bp_lineups.entry_id is
  '클라이언트 생성 UUID. localStorage entryId와 일치. (owner, entry_id) unique로 upsert 기준.';
comment on column public.bp_lineups.is_published is
  'true면 공개 매칭 풀 노출. PR2에서 활성화.';
