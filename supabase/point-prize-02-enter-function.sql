-- BallPlay BP prize entry function.
-- Run after point-prize-01-tables.sql.

create or replace function public.enter_point_prize(
  p_prize_id uuid,
  p_user_id uuid,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $enter_point_prize$
declare
  prize_row public.point_prizes%rowtype;
  current_balance integer;
  total_cost integer;
  tx_id uuid;
  user_entry_count integer;
begin
  if p_prize_id is null or p_user_id is null then
    raise exception 'prize_id and user_id are required';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception 'quantity must be between 1 and 10';
  end if;

  select *
    into prize_row
  from public.point_prizes
  where id = p_prize_id
  for update;

  if not found then
    raise exception 'Prize not found';
  end if;

  if prize_row.status <> 'active' then
    raise exception 'Prize is not open';
  end if;

  if now() < prize_row.starts_at then
    raise exception 'Prize has not started';
  end if;

  if now() >= prize_row.ends_at then
    raise exception 'Prize entry is closed';
  end if;

  total_cost := prize_row.entry_cost * p_quantity;

  insert into public.point_balances (user_id, balance, lifetime_earned, lifetime_spent, updated_at)
  values (p_user_id, 0, 0, 0, now())
  on conflict (user_id) do nothing;

  select balance
    into current_balance
  from public.point_balances
  where user_id = p_user_id
  for update;

  if coalesce(current_balance, 0) < total_cost then
    raise exception 'Insufficient BP';
  end if;

  insert into public.point_transactions (
    user_id,
    amount,
    type,
    reason,
    reference_type,
    reference_id,
    metadata
  )
  values (
    p_user_id,
    -total_cost,
    'spend',
    'prize_entry',
    'point_prize',
    p_prize_id::text,
    jsonb_build_object('quantity', p_quantity, 'entry_cost', prize_row.entry_cost)
  )
  returning id into tx_id;

  update public.point_balances
  set
    balance = balance - total_cost,
    lifetime_spent = lifetime_spent + total_cost,
    updated_at = now()
  where user_id = p_user_id
  returning balance into current_balance;

  insert into public.point_prize_entries (prize_id, user_id, point_transaction_id)
  select p_prize_id, p_user_id, tx_id
  from generate_series(1, p_quantity);

  select count(*)
    into user_entry_count
  from public.point_prize_entries
  where prize_id = p_prize_id
    and user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'balance', current_balance,
    'spent', total_cost,
    'quantity', p_quantity,
    'entry_count', user_entry_count,
    'transaction_id', tx_id
  );
end;
$enter_point_prize$;

grant execute on function public.enter_point_prize(uuid, uuid, integer)
  to service_role;
