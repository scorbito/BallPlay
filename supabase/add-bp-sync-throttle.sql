-- BallPlay bp_sync_throttle — 서버 side throttle key store.
--
-- 용도:
--   페이지가 KBO sync를 트리거할 때, 같은 key 가 N분 이내에 호출됐거나
--   현재 진행 중(in_flight)이면 스킵. 동시 사용자 다수가 페이지 열어도
--   외부 KBO API는 1번만 호출하도록 제어.
--
-- 키 패턴:
--   games-sync:YYYY-MM-DD       (특정 날짜 게임 결과)
--   lineups-sync:YYYY-MM-DD     (특정 날짜 라인업)
--   standings-sync:YYYY          (시즌 순위)
--   ai-scoring:YYYY-MM-DD       (특정 날짜 AI 채점)
--
-- service_role 만 read/write (페이지 server component → admin client).

create table if not exists public.bp_sync_throttle (
  key text primary key,
  last_run timestamptz not null default now(),
  in_flight boolean not null default false,
  in_flight_started_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists bp_sync_throttle_last_run_idx
  on public.bp_sync_throttle (last_run desc);

-- RLS: write 는 service_role 만. read 도 의미 없으니 정책 안 둠 (anon/auth 차단).
alter table public.bp_sync_throttle enable row level security;

comment on table public.bp_sync_throttle is
  '서버 사이드 throttle 키. 페이지 진입 시 트리거되는 KBO sync 의 동시 호출/잦은 호출 차단.';

-- ============================================================
-- RPC — atomic "claim" 시도.
--   tryClaim(p_key, p_throttle_seconds) → boolean
--     true : 이 호출자가 lock 획득 (sync 진행 가능)
--     false: 이미 다른 호출자가 in_flight 또는 throttle 내
--   INSERT ... ON CONFLICT 한 번으로 race 없이 결정.
-- ============================================================

create or replace function public.bp_sync_throttle_try_claim(
  p_key text,
  p_throttle_seconds int
) returns boolean
language plpgsql as $$
declare
  v_now timestamptz := now();
  v_existing public.bp_sync_throttle%rowtype;
  v_in_flight_timeout_seconds constant int := 120;  -- 2분 넘는 in_flight는 죽은 락으로 간주
begin
  -- 새 키면 바로 lock 획득.
  insert into public.bp_sync_throttle (key, last_run, in_flight, in_flight_started_at, updated_at)
    values (p_key, v_now, true, v_now, v_now)
    on conflict (key) do nothing;

  if found then
    return true;
  end if;

  -- 기존 키 — 조건 검사.
  select * into v_existing
    from public.bp_sync_throttle
    where key = p_key
    for update;

  -- 정상 in_flight (timeout 안 됨) → 양보.
  if v_existing.in_flight
     and v_existing.in_flight_started_at is not null
     and v_existing.in_flight_started_at > v_now - make_interval(secs => v_in_flight_timeout_seconds)
  then
    return false;
  end if;

  -- throttle 내 → 양보.
  if v_existing.last_run > v_now - make_interval(secs => p_throttle_seconds)
  then
    return false;
  end if;

  -- lock 획득.
  update public.bp_sync_throttle
    set in_flight = true,
        in_flight_started_at = v_now,
        updated_at = v_now
    where key = p_key;

  return true;
end;
$$;

-- 작업 완료 시 호출 — last_run 갱신 + in_flight 해제.
create or replace function public.bp_sync_throttle_release(p_key text)
returns void
language sql as $$
  update public.bp_sync_throttle
    set in_flight = false,
        in_flight_started_at = null,
        last_run = now(),
        updated_at = now()
    where key = p_key;
$$;

grant execute on function public.bp_sync_throttle_try_claim(text, int) to service_role;
grant execute on function public.bp_sync_throttle_release(text) to service_role;
