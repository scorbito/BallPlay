"use client";

import { useEffect, type CSSProperties } from "react";

// 안타 발사 시 타자 위치에 동시에 표시되는 배트 스윙 이펙트.
// FlyingBall 과 sibling 으로 동시 발사 — FlyingBall 로직은 건드리지 않는다.
// 우타("R"/"S")는 화면 왼쪽 → 오른쪽(시계방향 회전), 좌타("L")는 오른쪽 → 왼쪽(반시계).
export function BatSwing({
  centerX,
  centerY,
  battingHand,
  onEnd
}: {
  centerX: number;
  centerY: number;
  battingHand: "L" | "R";
  onEnd: () => void;
}) {
  // animation end 가 안 들어오는 케이스 대비 — 안전 타임아웃으로 onEnd 보장.
  useEffect(() => {
    const t = window.setTimeout(onEnd, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 우타: 0 → -135° (반시계방향), 좌타: 0 → -135° (좌타도 반시계방향).
  // SVG 자체도 좌/우타에 따라 손잡이 위치가 반대편에 오도록 반전.
  const isLeft = battingHand === "L";
  const rotEndDeg = -135;
  // SVG 의 손잡이를 자연스럽게 두기 위해 좌타는 수평 반전.
  const flipX = isLeft ? -1 : 1;
  // 좌타는 우타의 거울상 — 위치도 공 기준 오른쪽으로 offset.
  const offsetX = isLeft ? 60 : 0;

  const style: CSSProperties = {
    left: `${centerX + offsetX}px`,
    top: `${centerY}px`,
    ["--bat-rot-end" as string]: `${rotEndDeg}deg`,
    ["--bat-flip-x" as string]: String(flipX),
    animationName: "stadium-bat-swing",
    animationDuration: "500ms",
    animationTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
    animationFillMode: "forwards"
  };

  return (
    <div
      className="stadium-bat-swing"
      style={style}
      onAnimationEnd={onEnd}
      aria-hidden="true"
    >
      {/* 인라인 SVG 배트 — viewBox 70x12.
          배럴(barrel): 굵은 갈색 그라데이션 막대, 손잡이(grip): 가늘게 테이퍼.
          좌하단(0, 12) 부근이 손잡이 끝 = transform-origin 으로 사용. */}
      <svg
        viewBox="0 0 70 12"
        xmlns="http://www.w3.org/2000/svg"
        width="70"
        height="12"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="bat-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5a3a1a" />
            <stop offset="50%" stopColor="#8b5a2b" />
            <stop offset="100%" stopColor="#a06a35" />
          </linearGradient>
        </defs>
        {/* 손잡이 노브(knob) — 끝부분 약간 굵게 */}
        <circle cx="2" cy="6" r="2.2" fill="#3d2410" />
        {/* 손잡이(grip) — 가늘게 */}
        <rect x="3" y="5" width="14" height="2" rx="1" fill="#3d2410" />
        {/* 배럴(barrel) — 두께감 있는 막대 */}
        <path
          d="M17 4.2 L62 3 Q68 3 68 6 Q68 9 62 9 L17 7.8 Z"
          fill="url(#bat-grad)"
          stroke="#3d2410"
          strokeWidth="0.4"
        />
      </svg>
    </div>
  );
}
