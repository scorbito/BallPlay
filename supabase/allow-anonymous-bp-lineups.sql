-- BallPlay — 익명 user의 라인업 공개/매치 기록 허용.
-- 이전 정책(add-bp-lineups-block-anonymous.sql, add-bp-records.sql)에서 익명 차단했으나
-- 익명도 1슬롯 한정이라 부담 적고, 공개 매치 안 해보면 재미를 못 느끼는 문제로 풀어줌.
--
-- 정책 변화:
--   - bp_lineups INSERT/UPDATE/DELETE: 익명도 본인 row 자유 조작 (1슬롯이라 양 제한됨)
--   - bp_records INSERT/UPDATE: 익명도 본인 매치 기록 가능
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

-- ============================================================
-- bp_lineups — 익명 차단 해제 (본인 row만 조작 가능 조건만 유지)
-- ============================================================
drop policy if exists "bp_lineups_insert" on public.bp_lineups;
create policy "bp_lineups_insert"
on public.bp_lineups for insert
to authenticated
with check (
  owner_user_id = auth.uid()
);

drop policy if exists "bp_lineups_update" on public.bp_lineups;
create policy "bp_lineups_update"
on public.bp_lineups for update
to authenticated
using (
  owner_user_id = auth.uid()
)
with check (
  owner_user_id = auth.uid()
);

drop policy if exists "bp_lineups_delete" on public.bp_lineups;
create policy "bp_lineups_delete"
on public.bp_lineups for delete
to authenticated
using (
  owner_user_id = auth.uid()
);

-- ============================================================
-- bp_records — 익명 차단 해제 (본인 row만 조작 가능 조건만 유지)
-- ============================================================
drop policy if exists "bp_records_insert_own" on public.bp_records;
create policy "bp_records_insert_own"
on public.bp_records for insert
to authenticated
with check (
  owner_user_id = auth.uid()
);

drop policy if exists "bp_records_update_own" on public.bp_records;
create policy "bp_records_update_own"
on public.bp_records for update
to authenticated
using (
  owner_user_id = auth.uid()
)
with check (
  owner_user_id = auth.uid()
);

-- 정책 확인용
-- select polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr,
--                          pg_get_expr(polwithcheck, polrelid) as check_expr
-- from pg_policy
-- where polrelid in ('public.bp_lineups'::regclass, 'public.bp_records'::regclass)
-- order by polrelid, polname;
