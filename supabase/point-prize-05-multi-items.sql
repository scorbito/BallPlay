-- BallPlay BP prize multi-item extension.
--
-- Run after point-prize-01-tables.sql, point-prize-02-enter-function.sql,
-- and point-prize-03-draw-function.sql.
--
-- Enables one prize campaign to contain multiple prize items, such as:
--   1등 치킨 1명
--   2등 커피 5명

create table if not exists public.point_prize_items (
  id uuid primary key default gen_random_uuid(),
  prize_id uuid not null references public.point_prizes(id) on delete cascade,
  rank_label text,
  title text not null,
  description text,
  image_url text,
  winner_count integer not null default 1 check (winner_count > 0),
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists point_prize_items_prize_order_idx
  on public.point_prize_items (prize_id, sort_order, created_at);

alter table public.point_prize_items enable row level security;

drop policy if exists "point_prize_items_select_visible" on public.point_prize_items;
create policy "point_prize_items_select_visible"
on public.point_prize_items for select
to authenticated
using (
  exists (
    select 1
    from public.point_prizes p
    where p.id = point_prize_items.prize_id
      and p.status in ('active', 'closed', 'drawn')
  )
);

alter table public.point_prize_winners
  add column if not exists prize_item_id uuid references public.point_prize_items(id) on delete set null;

alter table public.point_prize_winners
  add column if not exists item_winner_rank integer;

create unique index if not exists point_prize_winners_item_rank_idx
  on public.point_prize_winners (prize_item_id, item_winner_rank)
  where prize_item_id is not null and item_winner_rank is not null;

insert into public.point_prize_items (
  prize_id,
  rank_label,
  title,
  description,
  image_url,
  winner_count,
  sort_order
)
select
  p.id,
  case when p.winner_count = 1 then '1등' else '당첨' end,
  p.title,
  p.description,
  p.image_url,
  p.winner_count,
  1
from public.point_prizes p
where not exists (
  select 1
  from public.point_prize_items i
  where i.prize_id = p.id
);

create or replace function public.draw_point_prize_winners(p_prize_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $draw_point_prize_winners$
declare
  prize_row public.point_prizes%rowtype;
  entry_count integer;
  winner_total integer;
  target_winner_count integer;
begin
  if p_prize_id is null then
    raise exception 'prize_id is required';
  end if;

  select *
    into prize_row
  from public.point_prizes
  where id = p_prize_id
  for update;

  if not found then
    raise exception 'Prize not found';
  end if;

  if prize_row.status = 'drawn' then
    select count(*) into winner_total
    from public.point_prize_winners
    where prize_id = p_prize_id;

    return jsonb_build_object(
      'ok', true,
      'already_drawn', true,
      'winner_count', winner_total
    );
  end if;

  if prize_row.status not in ('active', 'closed') then
    raise exception 'Prize cannot be drawn';
  end if;
  if now() < prize_row.draw_at then
    raise exception 'Draw time has not arrived';
  end if;

  insert into public.point_prize_items (
    prize_id,
    rank_label,
    title,
    description,
    image_url,
    winner_count,
    sort_order
  )
  select
    prize_row.id,
    case when prize_row.winner_count = 1 then '1등' else '당첨' end,
    prize_row.title,
    prize_row.description,
    prize_row.image_url,
    prize_row.winner_count,
    1
  where not exists (
    select 1
    from public.point_prize_items i
    where i.prize_id = prize_row.id
  );

  select count(*)
    into entry_count
  from public.point_prize_entries
  where prize_id = p_prize_id;

  select coalesce(sum(winner_count), 0)
    into target_winner_count
  from public.point_prize_items
  where prize_id = p_prize_id;

  if entry_count > 0 and target_winner_count > 0 then
    with item_slots as (
      select
        i.id as prize_item_id,
        i.rank_label,
        i.title,
        gs.item_winner_rank,
        row_number() over (
          order by i.sort_order asc, i.created_at asc, i.id asc, gs.item_winner_rank asc
        ) as winner_rank
      from public.point_prize_items i
      cross join lateral generate_series(1, i.winner_count) as gs(item_winner_rank)
      where i.prize_id = p_prize_id
    ),
    randomized_entries as (
      select
        e.id as entry_id,
        e.user_id,
        random() as sort_key
      from public.point_prize_entries e
      where e.prize_id = p_prize_id
    ),
    picked as (
      select
        entry_id,
        user_id,
        row_number() over (order by sort_key) as winner_rank
      from randomized_entries
      order by sort_key
      limit target_winner_count
    )
    insert into public.point_prize_winners (
      prize_id,
      prize_item_id,
      entry_id,
      user_id,
      winner_rank,
      item_winner_rank,
      metadata
    )
    select
      p_prize_id,
      s.prize_item_id,
      p.entry_id,
      p.user_id,
      s.winner_rank,
      s.item_winner_rank,
      jsonb_build_object(
        'rank_label', s.rank_label,
        'prize_item_title', s.title
      )
    from picked p
    join item_slots s on s.winner_rank = p.winner_rank
    on conflict do nothing;
  end if;

  update public.point_prizes
  set status = 'drawn', updated_at = now()
  where id = p_prize_id;

  select count(*)
    into winner_total
  from public.point_prize_winners
  where prize_id = p_prize_id;

  return jsonb_build_object(
    'ok', true,
    'already_drawn', false,
    'entry_count', entry_count,
    'winner_count', winner_total
  );
end;
$draw_point_prize_winners$;

grant execute on function public.draw_point_prize_winners(uuid)
  to service_role;

comment on table public.point_prize_items is
  'Prize items inside a BP prize campaign. One campaign can draw multiple item groups.';

notify pgrst, 'reload schema';
