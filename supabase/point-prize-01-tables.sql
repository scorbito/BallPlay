-- BallPlay BP prize raffle tables, indexes, and RLS policies.
-- Run this first.

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

comment on table public.point_prizes is
  'BP prize raffle campaigns. Create rows manually or through a future admin UI.';
comment on table public.point_prize_entries is
  'Non-cancelable BP prize entries. One row equals one ticket.';
comment on table public.point_prize_winners is
  'Fixed prize draw results.';
