-- Community free posts share match_posts, likes, and comments with match talk.
-- Run once in the Supabase SQL Editor before deploying the application changes.

alter table public.match_posts
  add column if not exists post_type text not null default 'match_talk',
  add column if not exists title text;

update public.match_posts
set post_type = 'match_talk'
where post_type is null;

alter table public.match_posts
  drop constraint if exists match_posts_post_type_check;

alter table public.match_posts
  add constraint match_posts_post_type_check
  check (post_type in ('free', 'match_talk'));

alter table public.match_posts
  alter column game_id drop not null;

alter table public.match_posts
  drop constraint if exists match_posts_community_shape_check;

alter table public.match_posts
  add constraint match_posts_community_shape_check
  check (
    (post_type = 'match_talk' and game_id is not null)
    or (post_type = 'free' and game_id is null and title is not null and length(btrim(title)) > 0)
  );

create index if not exists match_posts_post_type_created_at_idx
  on public.match_posts (post_type, created_at desc)
  where deleted_at is null;
