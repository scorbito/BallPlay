"use client";

// 사용자 등급 뱃지 — guest/free/pro/admin 표시.
// useUserTier 직접 호출 or tier prop으로 외부 주입 둘 다 지원.

import { ShieldCheck, Star, UserRound } from "lucide-react";
import { useUserTier } from "@/lib/auth/useUserTier";
import { TIER_LABEL, type UserTier } from "@/lib/auth/userTier";

type Props = {
  /** 외부에서 tier 주입 — 미지정 시 useUserTier()로 자체 조회 */
  tier?: UserTier;
  /** 게스트는 뱃지 숨김 (default false) */
  hideGuest?: boolean;
  size?: "sm" | "md";
};

const ICON_BY_TIER: Record<UserTier, typeof UserRound> = {
  guest: UserRound,
  free: UserRound,
  pro: Star,
  admin: ShieldCheck
};

export function TierBadge({ tier: tierProp, hideGuest = false, size = "sm" }: Props) {
  const fromHook = useUserTier();
  const tier = tierProp ?? fromHook.tier;
  if (hideGuest && tier === "guest") return null;
  const Icon = ICON_BY_TIER[tier];
  return (
    <span className={`tier-badge tier-badge-${tier} tier-badge-${size}`}>
      <Icon size={size === "sm" ? 12 : 14} />
      <span>{TIER_LABEL[tier]}</span>
    </span>
  );
}
