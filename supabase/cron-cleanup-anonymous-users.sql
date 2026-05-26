-- BallPlay — 30일 미접속 익명 user 자동 정리.
-- Supabase는 익명 user 자동 삭제 기능 없음 → pg_cron으로 직접 스케줄.
--
-- 동작:
--   - 매일 새벽 4시(UTC 19시 = KST 04시) 1회 실행
--   - last_sign_in_at이 30일 이전인 익명 user 삭제
--   - auth.users 삭제 시 CASCADE 따라 profiles + bp_* 테이블 데이터까지 동시 정리
--   - bp_matches만 FK 없어서 owner_id orphan으로 남음 (cosmetic, 무시 가능)
--
-- 사전 조건: pg_cron extension 활성화 필요.
--   Supabase Dashboard → Database → Extensions → pg_cron 검색 → ON.
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

-- ============================================================
-- pg_cron extension 활성화 확인
-- Supabase는 pg_cron을 pg_catalog 스키마에만 설치 허용 → 대시보드에서 활성화 권장.
-- (Dashboard → Database → Extensions → pg_cron 검색 → ON, 기본 pg_catalog 그대로)
-- 이미 켜져있으면 아래 라인 no-op.
-- ============================================================
create extension if not exists pg_cron;

-- ============================================================
-- 기존 동일 이름 잡 있으면 제거 (재실행 시 중복 방지)
-- ============================================================
do $$
declare
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'bp-cleanup-anonymous-users';
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;
end;
$$;

-- ============================================================
-- 스케줄 등록 — 매일 19:00 UTC = 04:00 KST
-- ============================================================
select cron.schedule(
  'bp-cleanup-anonymous-users',
  '0 19 * * *',
  $$
  delete from auth.users
  where is_anonymous = true
    and last_sign_in_at < now() - interval '30 days'
  $$
);

-- ============================================================
-- 확인용 (필요 시 수동 실행)
-- ============================================================
-- 등록된 잡 확인:
-- select jobname, schedule, command, active from cron.job where jobname like 'bp-%';
--
-- 최근 실행 이력:
-- select jobid, runid, status, return_message, start_time, end_time
-- from cron.job_run_details
-- where jobid in (select jobid from cron.job where jobname = 'bp-cleanup-anonymous-users')
-- order by start_time desc
-- limit 10;
--
-- 정리 대상 미리보기 (실행 전 확인):
-- select id, created_at, last_sign_in_at
-- from auth.users
-- where is_anonymous = true
--   and last_sign_in_at < now() - interval '30 days'
-- order by last_sign_in_at;
--
-- 수동 즉시 정리 (스케줄 안 기다리고 바로 돌리고 싶을 때):
-- delete from auth.users
-- where is_anonymous = true
--   and last_sign_in_at < now() - interval '30 days';
