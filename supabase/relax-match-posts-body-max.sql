-- 자유글 본문 길이 상한 완화 (경기톡 300자 → 자유글 포함 1000자 허용).
--   match_posts 는 경기톡·자유글을 함께 담는다. body 최대값만 300→1000 으로 완화한다.
--   기존 글(≤300)·본진("오늘은 승요") 사용에 영향 없음(상한만 넓힘).
--
-- Supabase SQL Editor 에서 1회 실행.

alter table public.match_posts drop constraint if exists match_posts_body_max;
alter table public.match_posts add constraint match_posts_body_max check (length(body) <= 1000);
