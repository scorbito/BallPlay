-- BallPlay BP prize raffle system.
--
-- Run after supabase/add-point-system.sql.
-- Users spend BP to create non-cancelable prize entries. Draws are fixed by
-- draw_point_prize_winners after draw_at.

create table if not exists public.point_prizes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  entry_cost integer not null default 200 check (entry_cost > 0),
  winner_count integer not null default 1 check (winner_count > 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  draw_at timestamptz not null,
  status text not null default 'active'
    check (status in ('draft', 'active', 'closed', 'drawn', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint point_prizes_valid_dates check (starts_at < ends_at and ends_at <= draw_at)
);

create index if not exists point_prizes_status_draw_idx
  on public.point_prizes (status, draw_at, ends_at);

create table if not exists public.point_prize_entries (
  id uuid primary key default gen_random_uuid(),
  prize_id uuid not null references public.point_prizes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  point_transaction_id uuid not null references public.point_transactions(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists point_prize_entries_prize_created_idx
  on public.point_prize_entries (prize_id, created_at desc);

create index if not exists point_prize_entries_user_created_idx
  on public.point_prize_entries (user_id, created_at desc);

create table if not exists public.point_prize_winners (
  id uuid primary key default gen_random_uuid(),
  prize_id uuid not null references public.point_prizes(id) on delete cascade,
  entry_id uuid not null references public.point_prize_entries(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  winner_rank integer not null check (winner_rank > 0),
  drawn_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (prize_id, winner_rank),
  unique (prize_id, entry_id)
);

create index if not exists point_prize_winners_user_drawn_idx
  on public.point_prize_winners (user_id, drawn_at desc);

alter table public.point_prizes enable row level security;
alter table public.point_prize_entries enable row level security;
alter table public.point_prize_winners enable row level security;

drop policy if exists "point_prizes_select_active" on public.point_prizes;
create policy "point_prizes_select_active"
on public.point_prizes for select
to authenticated
using (status in ('active', 'closed', 'drawn'));

drop policy if exists "point_prize_entries_select_own" on public.point_prize_entries;
create policy "point_prize_entries_select_own"
on public.point_prize_entries for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "point_prize_winners_select_visible" on public.point_prize_winners;
create policy "point_prize_winners_select_visible"
on public.point_prize_winners for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.point_prizes p
    where p.id = point_prize_winners.prize_id
      and p.status = 'drawn'
  )
);

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

comment on table public.point_prizes is
  'BP prize raffle campaigns. Create rows manually or through a future admin UI.';
comment on table public.point_prize_entries is
  'Non-cancelable BP prize entries. One row equals one ticket.';
comment on table public.point_prize_winners is
  'Fixed prize draw results.';

-- Example prize seed:
-- insert into public.point_prizes (
--   title,
--   description,
--   image_url,
--   entry_cost,
--   winner_count,
--   starts_at,
--   ends_at,
--   draw_at,
--   status
-- ) values (
--   '스타벅스 아메리카노',
--   'BP 200으로 응모하는 첫 경품 이벤트',
--   null,
--   200,
--   1,
--   now(),
--   now() + interval '7 days',
--   now() + interval '7 days 1 hour',
--   'active'
-- );

notify pgrst, 'reload schema';
