// 계정 누적 승수 마일스톤 뱃지 (홈/랭킹/내 기록 화면 공용).
// paid tier 용 [TierBadge](./TierBadge.tsx) 와는 별개 — 충돌 방지로 별도 명명.
//
// wins → getAccountTierByWins → 뱃지 이미지 + (옵션) 등급 이름 텍스트.

import Image from "next/image";
import type { ReactNode } from "react";
import { getAccountTierByWins, formatTierName } from "@/lib/tiers/accountTier";

type Props = {
  wins: number;
  /** 표시 크기 px. 기본 32. */
  size?: number;
  /** 등급 이름도 같이 표시. 기본 false. */
  showName?: boolean;
  /** 0승(등급 없음) 케이스 렌더 — null 이면 fragment(아무것도 안 보임). */
  emptyFallback?: ReactNode;
  className?: string;
};

export function AccountTierBadge({
  wins,
  size = 32,
  showName = false,
  emptyFallback = null,
  className
}: Props) {
  const tier = getAccountTierByWins(wins);
  if (!tier) {
    return <>{emptyFallback}</>;
  }
  const label = formatTierName(tier);
  // alt는 스크린리더용 — 등급 이름 + 마일스톤 승수 hint.
  const alt = `${label} 등급 뱃지 (${tier.threshold}승 달성)`;
  return (
    <span
      className={`account-tier-badge${className ? ` ${className}` : ""}`}
      style={{ ["--bp-tier-badge-size" as string]: `${size}px` }}
    >
      <Image
        src={tier.badgePath}
        alt={alt}
        width={size}
        height={size}
        className="account-tier-badge-img"
      />
      {showName ? <span className="account-tier-badge-name">{label}</span> : null}
    </span>
  );
}
