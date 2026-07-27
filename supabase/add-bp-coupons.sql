-- BallPlay bp_coupons — 당첨자 쿠폰함 (사이트 내 쿠폰 지급·보관).
--
-- ⚠️ 운영 DB 공유 — 수동 적용 필요.
--    운영 "오늘은 승요"와 공유하는 Supabase 프로젝트에 직접 실행됩니다.
--    Supabase SQL Editor에서 1회 수동 실행하세요. (자동 마이그레이션 없음)
--    bp_ 접두 신규 테이블 + coupon-images 비공개 버킷만 추가 — 기존 스키마 불변.
--
-- 목적:
--   운영자가 당첨자에게 쿠폰 이미지를 사이트에서 직접 지급 → 당첨자 계정에 보관.
--   외부 이메일/연락처 없이 "설정 > 내 쿠폰함"에서 열람·저장.
--
-- 보안:
--   쿠폰 이미지는 기프티콘(현금성)이라 비공개 버킷에 저장하고,
--   본인에게만 발급되는 서명 URL(단기 만료)로만 노출한다. URL 유출로 도용 불가.
--   지급(업로드/INSERT)은 운영자 서버가 service_role 로만 수행 → 클라 INSERT 정책 없음.
--
-- 본 SQL 은 idempotent — 반복 실행 안전.

-- 1) 쿠폰 테이블 ---------------------------------------------------------------
create table if not exists public.bp_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,  -- 받는 사람
  title text not null,                                -- 예: "메가커피 5,000원 쿠폰"
  image_path text not null,                           -- coupon-images 버킷 내 경로 ({uid}/{id}.ext)
  source text,                                        -- 예: "predict-king-2026-07-21"
  note text,                                          -- 운영 메모 (예: "예측왕 1등")
  issued_by uuid references auth.users(id),           -- 지급한 운영자
  issued_at timestamptz not null default now(),
  expires_at timestamptz,                             -- 쿠폰 만료(선택)
  viewed_at timestamptz,                              -- 당첨자가 처음 연 시각 (NEW 배지 판별)
  constraint bp_coupons_title_not_blank check (length(trim(title)) >= 1),
  constraint bp_coupons_title_max check (length(title) <= 120)
);

create index if not exists bp_coupons_user_issued_idx
  on public.bp_coupons (user_id, issued_at desc);

-- 2) RLS ---------------------------------------------------------------------
alter table public.bp_coupons enable row level security;

-- 조회: 본인 쿠폰만 (비공개). 운영자 전체 조회·지급은 service_role 우회.
drop policy if exists "users select own coupons" on public.bp_coupons;
create policy "users select own coupons" on public.bp_coupons
for select using (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE 정책 없음 — 지급·viewed 갱신은 서버(service_role) 전담.

-- 3) 비공개 스토리지 버킷 ------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('coupon-images', 'coupon-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 읽기: 본인 폴더({uid}/...)만. (실서비스는 서명 URL 사용이라 우회 접근 방어용.)
drop policy if exists "users read own coupon images" on storage.objects;
create policy "users read own coupon images"
on storage.objects for select
using (
  bucket_id = 'coupon-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- 업로드/삭제 정책 없음 — 운영자 서버가 service_role 로 수행.

notify pgrst, 'reload schema';
