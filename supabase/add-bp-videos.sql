-- BallPlay bp_videos — 사용자가 등록한 야구 영상 (유튜브/인스타/스레드).
-- 모든 인증 사용자가 SELECT 가능 (공유 풀). 본인만 INSERT/DELETE.
-- 익명 사용자는 INSERT 차단.
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

-- ============================================================
-- 1. 테이블
-- ============================================================
create table if not exists public.bp_videos (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  platform text not null check (platform in ('youtube', 'instagram', 'threads', 'other')),
  external_id text,
  orientation text not null default 'horizontal' check (orientation in ('horizontal', 'vertical')),
  -- 본인 동일 URL 중복 등록 차단용
  url_hash text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. 인덱스
-- ============================================================
-- 최신순 조회
create index if not exists bp_videos_created_idx
  on public.bp_videos (created_at desc);

-- 본인 영상 조회
create index if not exists bp_videos_owner_idx
  on public.bp_videos (owner_user_id);

-- 본인 중복 URL 차단
create unique index if not exists bp_videos_owner_url_unique
  on public.bp_videos (owner_user_id, url_hash);

-- ============================================================
-- 3. RLS
-- ============================================================
alter table public.bp_videos enable row level security;

-- SELECT — 모든 인증 사용자 (공유 풀)
drop policy if exists "bp_videos_select_all" on public.bp_videos;
create policy "bp_videos_select_all"
on public.bp_videos for select
to authenticated
using (true);

-- INSERT — 본인 row만, 익명 차단
drop policy if exists "bp_videos_insert_own" on public.bp_videos;
create policy "bp_videos_insert_own"
on public.bp_videos for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

-- DELETE — 본인 row만
drop policy if exists "bp_videos_delete_own" on public.bp_videos;
create policy "bp_videos_delete_own"
on public.bp_videos for delete
to authenticated
using (owner_user_id = auth.uid());

-- ============================================================
-- 4. 코멘트
-- ============================================================
comment on table public.bp_videos is
  '사용자가 등록한 야구 영상 (유튜브/인스타/스레드). 모든 인증 사용자가 SELECT 가능.';
comment on column public.bp_videos.url_hash is
  'URL 정규화 후 해시. 본인 중복 등록 차단(owner_user_id + url_hash unique).';
