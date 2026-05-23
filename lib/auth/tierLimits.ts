// 사용자 등급별 기능 제한 한도.
// 등급은 lib/auth/userTier.ts의 UserTier — guest/free/pro/admin.
//
// 기획 §10 비즈니스 모델 참고:
//   - 비로그인: 1슬롯
//   - 무료 로그인: 3슬롯
//   - 패스: 5~10슬롯
//   - admin은 사실상 무제한 (테스트용)

import type { UserTier } from "./userTier";

/** 라인업 저장 슬롯 한도 */
export const LINEUP_SLOT_LIMITS: Record<UserTier, number> = {
  guest: 1,
  free: 3,
  pro: 10,
  admin: 50
};

export function getLineupSlotLimit(tier: UserTier): number {
  return LINEUP_SLOT_LIMITS[tier];
}
