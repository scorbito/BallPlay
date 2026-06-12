-- BallPlay BP prize winner draw function.
-- Run after point-prize-01-tables.sql.

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
    select count(*)
      into winner_total
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

  select count(*)
    into entry_count
  from public.point_prize_entries
  where prize_id = p_prize_id;

  if entry_count > 0 then
    with picked as (
      select
        e.id as entry_id,
        e.user_id,
        row_number() over (order by random()) as winner_rank
      from public.point_prize_entries e
      where e.prize_id = p_prize_id
      order by random()
      limit prize_row.winner_count
    )
    insert into public.point_prize_winners (prize_id, entry_id, user_id, winner_rank)
    select p_prize_id, entry_id, user_id, winner_rank
    from picked
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

notify pgrst, 'reload schema';
