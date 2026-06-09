-- KBO 일일 경기 리포트 캐싱을 위한 테이블 생성
create table if not exists public.daily_ai_reports (
  report_date date primary key,
  report_json jsonb not null,
  created_at timestamptz default now() not null
);

-- 권한 부여
grant usage on schema public to anon, authenticated;
grant select on public.daily_ai_reports to anon, authenticated;

-- RLS 활성화
alter table public.daily_ai_reports enable row level security;

-- 조회 RLS 정책
drop policy if exists "daily_ai_reports are public readable" on public.daily_ai_reports;
create policy "daily_ai_reports are public readable"
on public.daily_ai_reports
for select
to anon, authenticated
using (true);

-- 수정 RLS 정책 (관리자 및 서버 인증 사용자)
drop policy if exists "daily_ai_reports are writable by admin/authenticated" on public.daily_ai_reports;
create policy "daily_ai_reports are writable by admin/authenticated"
on public.daily_ai_reports
for all
to authenticated
using (true)
with check (true);
