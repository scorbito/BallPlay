-- bp_news 썸네일 — 기사 og:image URL 저장 컬럼 추가.
-- crawl-news 라우트가 이미지 없는 최신 기사의 og:image를 추출해 채운다 (크롤당 제한).
-- idempotent — Supabase SQL Editor에서 1회 실행.

alter table public.bp_news add column if not exists image_url text;
