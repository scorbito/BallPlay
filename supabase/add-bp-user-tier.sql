-- BallPlay 사용자 등급 (tier) 시스템.
--
-- 등급 4단계:
--   - guest:  비로그인 또는 익명 로그인. 이 테이블에 row 없음.
--   - free:   정식 OAuth 로그인. 이 테이블에 row 없음 (기본값).
--   - pro:    유료 구독. row 존재 + expires_at > now().
--   - admin:  운영자. row 존재. expires_at 무시 (만료 X).
--
-- 즉 "row 없음 = guest/free" → 코드에서 auth.uid()로 구분.
--    "row 있음 = pro/admin" → tier 컬럼으로 구분.
--
-- v1: pro 결제 시스템 없음. admin이 수동으로 row INSERT.
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

create table if not exists public.bp_user_tier (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null check (tier in ('pro', 'admin')),
  expires_at timestamptz,
  granted_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 만료 체크 인덱스 (pro 만료 일괄 조회용)
create index if not exists bp_user_tier_expires_idx
  on public.bp_user_tier (expires_at)
  where tier = 'pro';

-- ============================================================
-- RLS — 본인 row만 읽기 허용 (가장 단순한 안전한 정책).
--   admin이 다른 사용자 row 보거나 부여하는 건 SQL Editor (postgres role)에서 처리.
--   client에서 admin 권한이 필요한 케이스는 v2+에서 SECURITY DEFINER 함수로 별도 노출.
--
-- 이전 버전엔 admin 확장 권한 policy에서 bp_user_tier 자기 자신을 EXISTS로 조회해
-- RLS 재귀 → 500 에러 발생. 본 버전은 단순화로 그 버그를 회피.
-- ============================================================
alter table public.bp_user_tier enable row level security;

-- 기존 잘못된 정책 제거 (이전 버전에서 만들었으면 정리)
drop policy if exists "bp_user_tier_admin_write" on public.bp_user_tier;
drop policy if exists "bp_user_tier_select" on public.bp_user_tier;

-- SELECT — 본인 row만
create policy "bp_user_tier_select_own"
on public.bp_user_tier for select
to authenticated
using (user_id = auth.uid());

-- INSERT/UPDATE/DELETE — 일반 client에선 일체 금지 (admin 작업은 SQL Editor로).
-- 정책 없음 = 차단 (RLS enabled + 매칭되는 policy 없으면 deny).

-- ============================================================
-- 운영자(본인) 등록 — 직접 user_id 채워 넣어야 함.
-- 본인 user_id 확인:
--   select id, email from auth.users where email = 'flycloudyworld@gmail.com';
--
-- 위 결과의 id를 아래 <YOUR_USER_ID>에 붙여넣고 한 줄 실행.
-- ============================================================
-- insert into public.bp_user_tier (user_id, tier, note)
-- values ('<YOUR_USER_ID>', 'admin', '본인 (개발/테스트용)')
-- on conflict (user_id) do update set tier = excluded.tier, updated_at = now();
