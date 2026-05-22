-- BallPlay bp_lineups — 익명 user의 DB 저장 자체 차단.
-- 기획 §10: 정식 계정 연동 사용자만 라인업 DB 동기화 + 공개 풀 참여.
--
-- 1차 방어: 코드 useLineupSync에서 익명 user는 local-only로 처리 → DB 호출 skip
-- 2차 방어 (이 파일): RLS에서 익명 user의 INSERT/UPDATE 거부
--
-- Supabase 익명 user는 JWT에 is_anonymous=true 클레임을 가짐. RLS에서 이 값으로 차단.
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

-- ============================================================
-- INSERT — 익명 user는 새 라인업 생성 불가
-- ============================================================
drop policy if exists "bp_lineups_insert" on public.bp_lineups;
create policy "bp_lineups_insert"
on public.bp_lineups for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

-- ============================================================
-- UPDATE — 익명 user는 본인 라인업도 변경 불가 (공개 토글 포함)
-- ============================================================
drop policy if exists "bp_lineups_update" on public.bp_lineups;
create policy "bp_lineups_update"
on public.bp_lineups for update
to authenticated
using (
  owner_user_id = auth.uid()
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
)
with check (
  owner_user_id = auth.uid()
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

-- ============================================================
-- DELETE — 익명 user는 본인 라인업 삭제도 불가
-- (별 의미는 없지만 일관성 차원)
-- ============================================================
drop policy if exists "bp_lineups_delete" on public.bp_lineups;
create policy "bp_lineups_delete"
on public.bp_lineups for delete
to authenticated
using (
  owner_user_id = auth.uid()
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

-- ============================================================
-- 기존 익명 user 데이터 정리 (이미 저장된 row 일괄 삭제)
-- ============================================================
delete from public.bp_lineups
where owner_user_id in (
  select id from auth.users where is_anonymous = true
);

-- 정리 결과 확인용
-- select count(*) as remaining_anonymous_rows
-- from public.bp_lineups l
-- join auth.users u on u.id = l.owner_user_id
-- where u.is_anonymous = true;
