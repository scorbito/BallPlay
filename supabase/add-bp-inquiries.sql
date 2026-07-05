-- BallPlay bp_inquiries — 앱 내 문의게시판 (비공개: 본인 + 운영자만).
--
-- ⚠️ 운영 DB 공유 — 수동 적용 필요.
--    운영 "오늘은 승요"와 공유하는 Supabase 프로젝트에 직접 실행됩니다.
--    Supabase SQL Editor에서 1회 수동 실행하세요. (자동 마이그레이션 없음)
--    bp_ 접두 신규 테이블만 추가 — 기존 스키마는 건드리지 않습니다.
--
-- 목적:
--   당첨자 경품 수령 등 문의를 로그인 계정에 묶어 저장 → 게시자 신원 자동 확인.
--   조회/작성은 본인만(비공개). 운영자는 service_role 로 전체 조회·답변.
--
-- 본 SQL 은 idempotent — 반복 실행 안전.

create table if not exists public.bp_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text,                                  -- 작성 시점 닉네임 스냅샷
  category text not null default 'general',       -- prize | general | bug | etc
  content text not null,
  status text not null default 'open',            -- open | answered
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bp_inquiries_content_not_blank check (length(trim(content)) >= 1),
  constraint bp_inquiries_content_max check (length(content) <= 2000)
);

create index if not exists bp_inquiries_user_id_created_idx
  on public.bp_inquiries (user_id, created_at desc);
create index if not exists bp_inquiries_status_created_idx
  on public.bp_inquiries (status, created_at desc);

-- updated_at 자동 갱신
create or replace function public.bp_inquiries_set_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;
drop trigger if exists bp_inquiries_touch on public.bp_inquiries;
create trigger bp_inquiries_touch
before update on public.bp_inquiries
for each row execute function public.bp_inquiries_set_updated_at();

-- RLS
alter table public.bp_inquiries enable row level security;

-- 조회: 본인 글만 (비공개). 운영자 전체 조회는 service_role 우회.
drop policy if exists "users select own inquiries" on public.bp_inquiries;
create policy "users select own inquiries" on public.bp_inquiries
for select using (auth.uid() = user_id);

-- 작성: 본인 + 비익명 로그인만.
drop policy if exists "users insert own inquiries" on public.bp_inquiries;
create policy "users insert own inquiries" on public.bp_inquiries
for insert with check (
  auth.uid() = user_id
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

notify pgrst, 'reload schema';
