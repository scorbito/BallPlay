// 사용자 등급별 기능 제한 한도.
// 등급은 lib/auth/userTier.ts의 UserTier — guest/free/pro/admin.
//
// 슬롯 정책 (2026-05-26 갱신):
//   - 비로그인/익명(guest): 2슬롯 — 본인 라인업끼리 대결 체험 가능
//   - 무료 로그인(free): 5슬롯
//   - 패스(pro): 10슬롯
//   - admin은 사실상 무제한 (테스트용)

import type { UserTier } from "./userTier";

/** 라인업 저장 슬롯 한도 */
export const LINEUP_SLOT_LIMITS: Record<UserTier, number> = {
  guest: 2,
  free: 5,
  pro: 10,
  admin: 50
};

export function getLineupSlotLimit(tier: UserTier): number {
  return LINEUP_SLOT_LIMITS[tier];
}
