-- BallPlay bp_videos — 자동 큐레이션 (놀이터봇) 지원.
-- 봇이 YouTube Data API로 수집한 인기 야구 영상을 자동 INSERT.
-- 본인 등록 영상과 구분 위해 is_auto_curated 컬럼 추가.
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.
--
-- 사전 준비:
--   1. Supabase Authentication에서 "놀이터봇" 계정 생성 (이메일: bot@ballnori.com 등)
--   2. 봇 user_id 메모해서 GitHub Actions secret BALLPLAY_BOT_USER_ID 로 등록
--   3. 봇 계정에는 RLS INSERT 정책이 (with check: owner_user_id = auth.uid()) 라서
--      service_role 키를 쓰면 RLS 우회되므로 그대로 INSERT 가능.

-- ============================================================
-- 1. 컬럼 추가
-- ============================================================
alter table public.bp_videos
  add column if not exists is_auto_curated boolean not null default false;

alter table public.bp_videos
  add column if not exists curated_keyword text;

alter table public.bp_videos
  add column if not exists view_count bigint;

alter table public.bp_videos
  add column if not exists published_at timestamptz;

-- ============================================================
-- 2. 인덱스 — 자동 큐레이션 영상 별도 조회 가능
-- ============================================================
create index if not exists bp_videos_auto_curated_idx
  on public.bp_videos (is_auto_curated, created_at desc);

-- ============================================================
-- 3. 코멘트
-- ============================================================
comment on column public.bp_videos.is_auto_curated is
  '놀이터봇이 자동 등록한 영상이면 true. UI에서 🤖 배지로 구분.';
comment on column public.bp_videos.curated_keyword is
  '자동 등록 시 검색에 사용된 키워드 (디버그/통계용).';
comment on column public.bp_videos.view_count is
  'YouTube 조회수 (큐레이션 시점 스냅샷). 인기 영상 필터링용.';
comment on column public.bp_videos.published_at is
  'YouTube 영상 업로드 일시. 최신 영상 우선 노출 가능.';
