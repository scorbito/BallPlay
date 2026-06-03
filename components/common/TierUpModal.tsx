"use client";

// 승급 모달 — 큰 뱃지 + 등급 이름 + 축하 메시지 + CSS 폭죽 + score.mp3.
// ModalShell 사용해 기존 모달 스타일/접근성 패턴 유지.

import { useEffect } from "react";
import Image from "next/image";
import { ModalShell } from "@/components/common/ModalShell";
import { playMatchSound } from "@/lib/sound/matchSounds";
import { formatTierName, type AccountTier } from "@/lib/tiers/accountTier";

// 폭죽 입자 색상 — BallPlay 핑크 + 보조 톤들.
const CONFETTI_COLORS = [
  "#e84a8a", // BP pink
  "#f4b400", // gold
  "#5b8def", // blue
  "#4ade80", // green
  "#a855f7", // purple
  "#fb923c" // orange
];
const CONFETTI_COUNT = 32;

type Props = {
  open: boolean;
  tier: AccountTier | null;
  onClose: () => void;
};

export function TierUpModal({ open, tier, onClose }: Props) {
  // 모달 노출 시점에 score 효과음 한 번.
  useEffect(() => {
    if (open && tier) {
      playMatchSound("score");
    }
  }, [open, tier]);

  if (!tier) return null;

  const label = formatTierName(tier);

  // 폭죽 입자 — 절대위치 + random offset/delay/duration. CSS keyframes로 떨어지면서 회전.
  // 외부 라이브러리 없이 CSS-only.
  const confetti = Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const left = (i * 97) % 100; // 의사 random 분산
    const delay = (i * 53) % 1200; // 0~1200ms
    const duration = 1800 + ((i * 71) % 1400); // 1800~3200ms
    const rotateStart = (i * 113) % 360;
    return (
      <span
        key={i}
        className="tier-up-confetti-piece"
        style={{
          left: `${left}%`,
          background: color,
          animationDelay: `${delay}ms`,
          animationDuration: `${duration}ms`,
          ["--bp-confetti-rotate-start" as string]: `${rotateStart}deg`
        }}
      />
    );
  });

  return (
    <ModalShell
      open={open}
      title="새 등급 달성!"
      ariaLabel={`${label} 등급 달성`}
      onClose={onClose}
      panelClassName="tier-up-modal-panel"
      backdropClassName="tier-up-modal-backdrop"
    >
      <div className="tier-up-confetti" aria-hidden="true">
        {confetti}
      </div>
      <div className="tier-up-modal-body">
        <div className="tier-up-modal-badge-wrap">
          <Image
            src={tier.badgePath}
            alt={`${label} 등급 뱃지`}
            width={160}
            height={160}
            priority
            className="tier-up-modal-badge"
          />
        </div>
        <strong className="tier-up-modal-name">{label}</strong>
        <p className="tier-up-modal-message">
          축하해요! &lsquo;{label}&rsquo; 등급에 올랐어요!
        </p>
        <button type="button" className="tier-up-modal-confirm" onClick={onClose}>
          확인
        </button>
      </div>
    </ModalShell>
  );
}
