-- BallPlay bp_push_subscriptions — 웹 푸시(Web Push) 구독 저장.
--
-- ⚠️ 운영 DB 공유 — 수동 적용 필요.
--    이 SQL 은 운영 "오늘은 승요" 와 공유하는 Supabase 프로젝트에 직접 실행됩니다.
--    Supabase SQL Editor 에서 1회 수동 실행하세요. (자동 마이그레이션 없음)
--    bp_ 접두 신규 테이블만 추가 — 기존 스키마는 건드리지 않습니다.
--
-- 흐름:
--   1. 설정 화면 "알림 받기" 토글 ON → 브라우저 권한 요청 → PushManager.subscribe
--   2. POST /api/push/subscribe → 본인 user.id 로 이 테이블에 upsert (익명 계정도 OK)
--   3. 매일 12:00 KST cron(/api/cron/push-daily) 이 service_role 로 전체 조회 → 발송
--   4. 만료(410/404) 구독은 cron 이 endpoint 로 자동 삭제
--
-- 정책:
--   - endpoint unique — 같은 브라우저/기기 1행
--   - 본인 구독만 select/insert/delete (RLS). 발송(전체 조회)은 service_role 우회.
--
-- 본 SQL 은 idempotent — 반복 실행 안전.

create table if not exists public.bp_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bp_push_subscriptions_user_idx
  on public.bp_push_subscriptions(user_id);

-- updated_at 자동 갱신
create or replace function public.bp_push_subscriptions_set_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists bp_push_subscriptions_updated_at on public.bp_push_subscriptions;
create trigger bp_push_subscriptions_updated_at
  before update on public.bp_push_subscriptions
  for each row execute function public.bp_push_subscriptions_set_updated_at();

-- RLS — 본인 구독만 insert/update/delete/select, 발송은 service_role.
alter table public.bp_push_subscriptions enable row level security;

drop policy if exists "own insert" on public.bp_push_subscriptions;
create policy "own insert" on public.bp_push_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own delete" on public.bp_push_subscriptions;
create policy "own delete" on public.bp_push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "own select" on public.bp_push_subscriptions;
create policy "own select" on public.bp_push_subscriptions
  for select to authenticated using (auth.uid() = user_id);

-- upsert(onConflict endpoint) 시 기존 row 의 user_id/keys 갱신 허용 — 본인 것만.
drop policy if exists "own update" on public.bp_push_subscriptions;
create policy "own update" on public.bp_push_subscriptions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.bp_push_subscriptions is
  '웹 푸시 구독. endpoint unique. 본인만 read/write, 발송은 service_role. 만료 구독은 cron 이 정리.';
