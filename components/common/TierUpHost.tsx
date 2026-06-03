"use client";

// 승급 감지 + 모달 노출을 한 곳에 묶은 client island.
// Server Component(HomeScreen 등)에서 그대로 마운트 가능하도록 client wrapper로 분리.

import { useTierUpDetector } from "@/lib/tiers/useTierUpDetector";
import { TierUpModal } from "@/components/common/TierUpModal";

type Props = {
  /** 현재 사용자 누적 승수. 미로그인/익명 0승이면 동작 없음. */
  wins: number;
};

export function TierUpHost({ wins }: Props) {
  const { newlyUnlockedTier, acknowledge } = useTierUpDetector(wins);
  return (
    <TierUpModal
      open={newlyUnlockedTier !== null}
      tier={newlyUnlockedTier}
      onClose={acknowledge}
    />
  );
}
