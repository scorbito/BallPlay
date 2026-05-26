-- BallPlay — bp_records.home_lineup_id / away_lineup_id에 FK + ON DELETE SET NULL 추가.
--
-- 배경:
--   bp_records의 lineup_id 컬럼은 처음부터 FK constraint 없이 uuid로 정의됨.
--   라인업이 삭제되면 record의 lineup_id가 stale UUID로 남아 orphan 발생.
--   내 기록 화면의 라인업 필터가 그런 orphan을 어떤 chip에도 매칭 못 시켜 혼란.
--
-- 정책: SET NULL
--   - 라인업 삭제 시 그 라인업을 가리키던 record의 lineup_id를 NULL로.
--   - record 자체는 보존 → "전체"에선 계속 보이지만 개별 라인업 chip엔 X.
--   - 사용자 데이터(매치 히스토리) 손실 없음.
--
-- 적용 단계:
--   1) 기존 stale lineup_id를 NULL로 cleanup (FK 추가 전에 필수 — 안 그러면 FK 위반)
--   2) FK constraint 추가 (ON DELETE SET NULL)
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

-- ============================================================
-- 1) 기존 orphan cleanup — bp_lineups에 없는 lineup_id를 NULL로
-- ============================================================
update public.bp_records
set home_lineup_id = null
where home_lineup_id is not null
  and home_lineup_id not in (select id from public.bp_lineups);

update public.bp_records
set away_lineup_id = null
where away_lineup_id is not null
  and away_lineup_id not in (select id from public.bp_lineups);

-- ============================================================
-- 2) FK constraint 추가 (ON DELETE SET NULL)
-- ============================================================
-- 이미 같은 이름의 constraint가 있으면 drop 후 재생성 (idempotent).
alter table public.bp_records
  drop constraint if exists bp_records_home_lineup_fk;
alter table public.bp_records
  add constraint bp_records_home_lineup_fk
  foreign key (home_lineup_id)
  references public.bp_lineups(id)
  on delete set null;

alter table public.bp_records
  drop constraint if exists bp_records_away_lineup_fk;
alter table public.bp_records
  add constraint bp_records_away_lineup_fk
  foreign key (away_lineup_id)
  references public.bp_lineups(id)
  on delete set null;

-- ============================================================
-- 확인용
-- ============================================================
-- FK 등록 확인:
-- select conname, confdeltype
-- from pg_constraint
-- where conrelid = 'public.bp_records'::regclass
--   and conname like '%_lineup_fk';
-- confdeltype = 'n' 이면 SET NULL.
--
-- orphan 잔여 확인 (0이어야 정상):
-- select count(*) from public.bp_records
-- where (home_lineup_id is not null and home_lineup_id not in (select id from public.bp_lineups))
--    or (away_lineup_id is not null and away_lineup_id not in (select id from public.bp_lineups));
