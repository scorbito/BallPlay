-- BallPlay 공개 라인업 풀 매칭 — RLS 확장.
-- PR1: bp_lineups 테이블 + 본인 row만 read/write (add-bp-lineups.sql)
-- PR2: is_published=true인 row는 누구나 read 허용 (이 파일)
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

-- 기존 select 정책을 더 넓은 정책으로 교체:
--   - 본인 row는 항상 read
--   - is_published=true인 row는 모두 read (anon + authenticated)
drop policy if exists "bp_lineups_select" on public.bp_lineups;

create policy "bp_lineups_select_public_or_own"
on public.bp_lineups for select
to anon, authenticated
using (
  is_published = true
  or (auth.uid() is not null and owner_user_id = auth.uid())
);

-- insert/update/delete는 그대로 (본인만, authenticated). 변경 없음.
