-- 자유글(free)을 "제목 없이 내용만" 쓰는 SNS 형식으로 바꾸기 위한 제약 완화.
--
-- 기존 match_posts_community_shape_check 는 free 글에 title 필수(length>0)를 요구했다.
-- 이제 자유글은 제목이 없으므로 title 요구를 없앤다.
-- match_talk(경기톡) 분기는 그대로 유지 — 기존 동작에 영향 없음.
-- 멱등: drop if exists 후 재생성.

alter table public.match_posts
  drop constraint if exists match_posts_community_shape_check;

alter table public.match_posts
  add constraint match_posts_community_shape_check
  check (
    (post_type = 'match_talk' and game_id is not null)
    or (post_type = 'free' and game_id is null)
  );
