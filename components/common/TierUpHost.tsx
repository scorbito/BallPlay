"use client";

// 승급 감지 + 모달 노출을 한 곳에 묶은 client island.
// Server Component(HomeScreen 등)에서 그대로 마운트 가능하도록 client wrapper로 분리.

import { useTierUpDetector } from "@/lib/tiers/useTierUpDetector";
import { TierUpModal } from "@/components/common/TierUpModal";
import { SHOW_ACCOUNT_TIER } from "@/lib/tiers/config";

type Props = {
  /** 현재 사용자 누적 승수. 미로그인/익명 0승이면 동작 없음. */
  wins: number;
};

export function TierUpHost({ wins }: Props) {
  // 등급 노출 OFF(탈-게임) — 승급 모달 자체를 띄우지 않음. hook은 규칙상 조건부 호출 불가라
  // 항상 호출하되, 렌더만 차단.
  const { newlyUnlockedTier, acknowledge } = useTierUpDetector(SHOW_ACCOUNT_TIER ? wins : 0);
  if (!SHOW_ACCOUNT_TIER) return null;
  return (
    <TierUpModal
      open={newlyUnlockedTier !== null}
      tier={newlyUnlockedTier}
      onClose={acknowledge}
    />
  );
}
