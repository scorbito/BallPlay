-- 1. 조회수 기록을 위한 page_views 테이블 생성
create table if not exists public.page_views (
  page_path text primary key,
  view_count bigint not null default 0,
  updated_at timestamp with time zone not null default now()
);

-- RLS(Row Level Security) 활성화
alter table public.page_views enable row level security;

-- 조회는 누구나 가능하도록 RLS 정책 설정
drop policy if exists "page_views_select_policy" on public.page_views;
create policy "page_views_select_policy" on public.page_views
  for select using (true);

-- 2. 조회수 안전 증가를 위한 stored procedure (RPC) 생성
create or replace function public.increment_page_view(p_path text)
returns bigint
language plpgsql
security definer
as $$
declare
  new_count bigint;
begin
  insert into public.page_views (page_path, view_count, updated_at)
  values (p_path, 1, now())
  on conflict (page_path)
  do update set 
    view_count = page_views.view_count + 1,
    updated_at = now()
  returning view_count into new_count;
  
  return new_count;
end;
$$;

-- RLS가 켜져 있어도 SECURITY DEFINER 함수는 실행 가능하며,
-- 이를 안전하게 호출하기 위한 권한 부여
grant execute on function public.increment_page_view(text) to anon, authenticated;
