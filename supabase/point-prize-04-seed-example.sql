-- Optional test prize seed.
-- Run after point-prize-01-tables.sql.

insert into public.point_prizes (
  title,
  description,
  image_url,
  entry_cost,
  winner_count,
  starts_at,
  ends_at,
  draw_at,
  status
) values (
  '스타벅스 아메리카노',
  'BP 200으로 응모하는 첫 경품 이벤트',
  null,
  200,
  1,
  now(),
  now() + interval '7 days',
  now() + interval '7 days 1 hour',
  'active'
);
