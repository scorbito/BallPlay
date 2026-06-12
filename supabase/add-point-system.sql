-- BallPlay point system foundation.
--
-- Internal name is "point". The visible product label can stay "BP" and be
-- changed later without a schema migration.

create table if not exists public.point_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  lifetime_earned integer not null default 0 check (lifetime_earned >= 0),
  lifetime_spent integer not null default 0 check (lifetime_spent >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  type text not null check (type in ('earn', 'spend', 'adjust')),
  reason text not null,
  reference_type text,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint point_transactions_nonzero check (amount <> 0)
);

create index if not exists point_transactions_user_created_idx
  on public.point_transactions (user_id, created_at desc);

create index if not exists point_transactions_user_reason_created_idx
  on public.point_transactions (user_id, reason, created_at desc);

create table if not exists public.point_reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_key text not null,
  reward_date date not null,
  amount integer not null check (amount > 0),
  transaction_id uuid references public.point_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, reward_key, reward_date)
);

create index if not exists point_reward_claims_user_date_idx
  on public.point_reward_claims (user_id, reward_date desc);

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  streak_count integer not null check (streak_count >= 1),
  base_points integer not null default 20,
  bonus_points integer not null default 0,
  transaction_id uuid references public.point_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, checkin_date)
);

create index if not exists daily_checkins_user_date_idx
  on public.daily_checkins (user_id, checkin_date desc);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_date date not null,
  score integer not null check (score >= 0),
  total integer not null check (total > 0),
  completion_transaction_id uuid references public.point_transactions(id) on delete set null,
  bonus_transaction_id uuid references public.point_transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempts_user_date_idx
  on public.quiz_attempts (user_id, attempt_date desc);

alter table public.point_balances enable row level security;
alter table public.point_transactions enable row level security;
alter table public.point_reward_claims enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.quiz_attempts enable row level security;

drop policy if exists "point_balances_select_own" on public.point_balances;
create policy "point_balances_select_own"
on public.point_balances for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "point_transactions_select_own" on public.point_transactions;
create policy "point_transactions_select_own"
on public.point_transactions for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "point_reward_claims_select_own" on public.point_reward_claims;
create policy "point_reward_claims_select_own"
on public.point_reward_claims for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "daily_checkins_select_own" on public.daily_checkins;
create policy "daily_checkins_select_own"
on public.daily_checkins for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "quiz_attempts_select_own" on public.quiz_attempts;
create policy "quiz_attempts_select_own"
on public.quiz_attempts for select
to authenticated
using (user_id = auth.uid());

comment on table public.point_balances is
  'Current point balance. UI displays the currency as BP.';
comment on table public.point_transactions is
  'Append-only point ledger for earn, spend, and admin adjustment events.';
comment on table public.point_reward_claims is
  'Idempotency table for once-per-day or once-per-content point rewards.';

create or replace function public.award_points(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_reference_type text default null,
  p_reference_id text default null,
  p_reward_key text default null,
  p_reward_date date default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_id uuid;
  tx_id uuid;
  new_balance integer;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;
  if p_amount <= 0 then
    raise exception 'award amount must be positive';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason is required';
  end if;

  if p_reward_key is not null then
    insert into public.point_reward_claims (user_id, reward_key, reward_date, amount)
    values (p_user_id, p_reward_key, coalesce(p_reward_date, (now() at time zone 'Asia/Seoul')::date), p_amount)
    on conflict (user_id, reward_key, reward_date) do nothing
    returning id into claim_id;

    if claim_id is null then
      select balance into new_balance
      from public.point_balances
      where user_id = p_user_id;

      return jsonb_build_object(
        'awarded', false,
        'amount', 0,
        'balance', coalesce(new_balance, 0),
        'reason', p_reason,
        'already_claimed', true
      );
    end if;
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
    p_amount,
    'earn',
    p_reason,
    p_reference_type,
    p_reference_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into tx_id;

  insert into public.point_balances (user_id, balance, lifetime_earned, updated_at)
  values (p_user_id, p_amount, p_amount, now())
  on conflict (user_id)
  do update set
    balance = public.point_balances.balance + excluded.balance,
    lifetime_earned = public.point_balances.lifetime_earned + excluded.lifetime_earned,
    updated_at = now()
  returning balance into new_balance;

  if claim_id is not null then
    update public.point_reward_claims
    set transaction_id = tx_id
    where id = claim_id;
  end if;

  return jsonb_build_object(
    'awarded', true,
    'amount', p_amount,
    'balance', new_balance,
    'transaction_id', tx_id,
    'reason', p_reason,
    'already_claimed', false
  );
end;
$$;

grant execute on function public.award_points(uuid, integer, text, text, text, text, date, jsonb)
  to service_role;

comment on function public.award_points(uuid, integer, text, text, text, text, date, jsonb) is
  'Atomic point award helper with optional reward-key idempotency. Intended for server/service-role calls.';

notify pgrst, 'reload schema';
