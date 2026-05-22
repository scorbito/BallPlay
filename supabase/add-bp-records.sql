-- BallPlay bp_records — 경기 기록 저장 (공개 라인업 매칭 + 친구 대전만).
-- 기획:
--   - source: 'public' (공개 풀 매칭) | 'friend' (친구 대전). AI 대전은 저장 X.
--   - retention: 7일. 7일 후엔 input/result JSON을 NULL 처리해서 재생만 불가 (목록 표시는 유지).
--                정리는 별도 pg_cron 또는 클라이언트에서 처리 (v1은 클라이언트 필터로 충분).
--   - 익명 user: DB 저장 차단 (정식 계정만). 익명은 localStorage로만 보관.
--   - 엔진 버전: 저장 시 SIM_ENGINE_VERSION 기록 → 재생 시 mismatch면 재생 차단.
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

-- ============================================================
-- 테이블
-- ============================================================
create table if not exists public.bp_records (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,

  -- 저장 가능 매치 분류 — AI 제외
  source text not null check (source in ('public', 'friend')),

  -- 친구 대전이면 bp_matches.id 연결 (옵션 — 매치가 삭제돼도 기록은 남음)
  bp_match_id uuid references public.bp_matches(id) on delete set null,

  -- 사용자 측 (home 또는 away 중 본인이 어느 쪽이었는지)
  user_side text not null check (user_side in ('home', 'away')),

  -- 엔진 / 시드 / 풀 데이터 — 재생용. 7일 후 NULL 처리되어 재생 불가.
  engine_version text not null,
  seed bigint not null,
  input jsonb,
  result jsonb,

  -- 영구 보존 필드 (목록 표시용, retention 적용 후에도 남음)
  home_team_id text not null,
  away_team_id text not null,
  home_label text,
  away_label text,
  final_score jsonb not null,           -- {home: number, away: number}
  mvp_player_id text,
  mvp_name text,
  is_walkoff boolean not null default false,
  total_innings integer not null default 9,

  -- 사용자가 직접 단 라벨 (옵션)
  name text,

  created_at timestamptz not null default now()
);

-- ============================================================
-- 인덱스 — 본인 기록 최신순 조회 빈도가 높음
-- ============================================================
create index if not exists bp_records_owner_created_idx
  on public.bp_records (owner_user_id, created_at desc);

-- 친구 대전 한 쌍 찾기 용도 (양쪽 client가 같은 bp_match_id로 자기 행을 INSERT)
create index if not exists bp_records_match_idx
  on public.bp_records (bp_match_id)
  where bp_match_id is not null;

-- ============================================================
-- RLS
-- ============================================================
alter table public.bp_records enable row level security;

-- SELECT — 본인 행만 (익명도 본인 행 읽기는 허용 — 다만 INSERT가 막혀서 어차피 본인 행 없음)
drop policy if exists "bp_records_select_own" on public.bp_records;
create policy "bp_records_select_own"
on public.bp_records for select
to authenticated
using (
  owner_user_id = auth.uid()
);

-- INSERT — 본인 행 + 익명 차단 (bp_lineups와 동일 패턴)
drop policy if exists "bp_records_insert_own" on public.bp_records;
create policy "bp_records_insert_own"
on public.bp_records for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

-- UPDATE — 본인이 라벨(name) 수정 등 가능. 익명 차단.
drop policy if exists "bp_records_update_own" on public.bp_records;
create policy "bp_records_update_own"
on public.bp_records for update
to authenticated
using (
  owner_user_id = auth.uid()
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
)
with check (
  owner_user_id = auth.uid()
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

-- DELETE — 본인이 직접 삭제 가능
drop policy if exists "bp_records_delete_own" on public.bp_records;
create policy "bp_records_delete_own"
on public.bp_records for delete
to authenticated
using (
  owner_user_id = auth.uid()
);

-- ============================================================
-- (선택) 7일 retention 클린업 — 즉시 실행 안 함, 필요 시 별도 cron 잡으로 스케줄
-- ============================================================
-- 1주일 지난 행의 input/result만 NULL로 비우기 (목록 표시는 유지)
-- update public.bp_records
--   set input = null, result = null
--   where created_at < now() - interval '7 days'
--     and (input is not null or result is not null);
--
-- 더 적극적으로 행 자체 삭제하려면:
-- delete from public.bp_records
--   where created_at < now() - interval '30 days';
--
-- pg_cron 스케줄 예시 (필요 시):
-- select cron.schedule(
--   'bp-records-expire',
--   '0 4 * * *',  -- 매일 새벽 4시
--   $$
--   update public.bp_records
--     set input = null, result = null
--     where created_at < now() - interval '7 days'
--       and input is not null
--   $$
-- );
