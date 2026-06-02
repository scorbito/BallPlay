-- 운영자 계정 추가 — scorbit.game@gmail.com
--
-- 사전 조건: 해당 이메일로 1회 이상 정식 로그인되어 auth.users에 row가 존재해야 함.
-- 미로그인 상태라면 먼저 사이트에서 Google OAuth로 로그인 후 본 SQL 실행.
--
-- Supabase SQL Editor에서 1회 실행. idempotent — 이미 등록된 경우 tier만 갱신.

insert into public.bp_user_tier (user_id, tier, note)
select id, 'admin', '운영자 (scorbit.game)'
from auth.users
where email = 'scorbit.game@gmail.com'
on conflict (user_id) do update
  set tier = excluded.tier,
      note = excluded.note,
      updated_at = now();

-- 결과 확인
select t.user_id, u.email, t.tier, t.note, t.created_at, t.updated_at
from public.bp_user_tier t
join auth.users u on u.id = t.user_id
where u.email = 'scorbit.game@gmail.com';
