-- BallPlay KBO 뉴스 — bet 프로젝트의 news 테이블을 bp_ prefix로 격리 이식.
--
-- 운영/타 프로젝트 테이블과 분리. 크롤은 /api/cron/crawl-news 가 채움 (Naver 검색 OpenAPI + Google RSS 폴백).
-- 데이터: 제목 + 링크 + 출처 + 게시시각. 7일 지난 건 bp_delete_old_news()로 정리.
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

create table if not exists public.bp_news (
  id           bigserial primary key,
  title        text not null,
  url          text not null unique,
  source       text,
  published_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists bp_news_published_at_idx
  on public.bp_news (published_at desc);

-- 7일 지난 뉴스 자동 삭제 — 크롤 라우트에서 RPC 호출
create or replace function public.bp_delete_old_news()
returns void
language sql
as $$
  delete from public.bp_news where created_at < now() - interval '7 days';
$$;

-- ============================================================
-- RLS
--   - SELECT: 누구나 (anon 포함) — 뉴스는 공개
--   - INSERT/UPDATE/DELETE: service_role 만 (크롤 라우트가 service key로 호출)
-- ============================================================
alter table public.bp_news enable row level security;

drop policy if exists "bp_news_select_public" on public.bp_news;
create policy "bp_news_select_public"
on public.bp_news for select
to anon, authenticated
using (true);

-- service_role 은 RLS 우회하므로 별도 write 정책 불필요.
-- (anon/authenticated 의 write 정책을 만들지 않음으로써 쓰기 차단)
