-- 승부예측(승리팀 예측) 주간 이벤트 — 당첨자 추첨 이력 + 보조 함수.
-- 정책:
--   - 주(화~일)별 1행. 재추첨하면 같은 주 행을 교체(upsert on week_start_date).
--   - service_role(관리자 서버액션)으로만 read/write. anon 접근 차단을 위해 RLS 활성 + 정책 없음.
--   - 메인 당첨(1명, AI 평균 초과) + 쿠폰 당첨(참여자 중 3명) 두 종류를 한 행에 보관.
--   - 추첨 대상은 로그인 계정만 (익명계정 제외) → bp_filter_logged_in_users 로 거른다.
--
-- 본 SQL 은 idempotent — Supabase SQL Editor 에서 1회 실행.

create table if not exists public.bp_predict_event_draws (
  id uuid primary key default gen_random_uuid(),
  week_start_date date not null unique,   -- 화요일
  week_end_date date not null,            -- 일요일
  game_count int not null default 0,
  threshold int not null default 0,       -- 자격선 = ceil(game_count * 2/3)
  ai_avg_accuracy numeric,                -- 0~100, 3 AI 적중률 평균 (없으면 null)
  qualifier_count int not null default 0,
  winner_user_id uuid,                    -- 메인 당첨자 (AI 평균 초과 중 1명)
  winner_nickname text,
  drawn_by uuid,                          -- 추첨 실행한 관리자
  drawn_at timestamptz not null default now()
);

-- 쿠폰 추첨(참여자 중 3명) 컬럼 — 기존 테이블에도 추가.
alter table public.bp_predict_event_draws
  add column if not exists participant_count int not null default 0,
  add column if not exists coupon_winners jsonb not null default '[]'::jsonb;
  -- coupon_winners: [{ "userId": "...", "nickname": "..." }, ...]

alter table public.bp_predict_event_draws enable row level security;
-- 정책 미생성 → anon/authenticated 는 접근 불가. service_role 만 우회.

comment on table public.bp_predict_event_draws is
  '승부예측 주간 이벤트 당첨 이력. 주(화~일)별 1행, 재추첨 시 교체. service_role 전용.';

-- ============================================================
-- 로그인(비익명) 계정 필터 — 추첨 대상은 로그인 계정만.
-- bp_predictions 엔 익명 여부가 없어 auth.users.is_anonymous 로 거른다.
-- security definer 로 auth 스키마 접근, service_role 전용.
-- ============================================================
create or replace function public.bp_filter_logged_in_users(p_ids uuid[])
returns table(user_id uuid)
language sql
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  where u.id = any(p_ids)
    and u.is_anonymous is distinct from true;
$$;

revoke all on function public.bp_filter_logged_in_users(uuid[]) from public, anon, authenticated;
