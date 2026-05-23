-- BallPlay 공지사항.
--
-- 운영 DB의 public.notices는 "오늘은 승요" 전용이라 스키마/데이터 모두 손대지 않음.
-- BallPlay 공지는 별도 bp_notices 테이블로 격리한다.
--
-- 스키마는 기존 notices와 동일한 모양(id/title/body/is_pinned/published_at)을
-- 따라서 lib/supabase/query-parts/notices.ts 의 toNotice() 매핑을 그대로 재사용 가능.
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

create table if not exists public.bp_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 목록 조회 최적화 — 고정 공지 먼저, 그 다음 최신순
create index if not exists bp_notices_published_idx
  on public.bp_notices (is_pinned desc, published_at desc);

-- ============================================================
-- RLS
--   - SELECT: 누구나(anon 포함). 단, 예약 게시(published_at > now())는 가림.
--   - INSERT/UPDATE/DELETE: bp_user_tier 에 admin row 가진 사용자만.
-- ============================================================
alter table public.bp_notices enable row level security;

-- 기존 정책 정리 (재실행 안전)
drop policy if exists "bp_notices_select_public" on public.bp_notices;
drop policy if exists "bp_notices_admin_write" on public.bp_notices;

create policy "bp_notices_select_public"
on public.bp_notices for select
to anon, authenticated
using (published_at <= now());

-- bp_user_tier 자기참조는 무한재귀 위험이 있지만(add-bp-user-tier.sql 주석 참조),
-- 여기서는 다른 테이블(bp_notices)에서 참조하므로 안전.
create policy "bp_notices_admin_write"
on public.bp_notices for all
to authenticated
using (
  exists (
    select 1 from public.bp_user_tier
    where user_id = auth.uid()
      and tier = 'admin'
  )
)
with check (
  exists (
    select 1 from public.bp_user_tier
    where user_id = auth.uid()
      and tier = 'admin'
  )
);

-- ============================================================
-- 첫 공지 시드 (선택) — 필요하면 아래 주석 풀고 실행.
-- ============================================================
-- insert into public.bp_notices (title, body, is_pinned)
-- values (
--   '야구놀이터 오픈했어요',
--   '라인업 짜고 경기장에서 친구랑 대결해보세요!',
--   true
-- );
