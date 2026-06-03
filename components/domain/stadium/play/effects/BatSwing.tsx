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
      {/* PNG 배트 — 가로 방향, 손잡이 좌측 / 배럴 우측. transform-origin 은 CSS 에서 설정. */}
      <img
        src="/assets/bat-swing.png"
        alt=""
        width="70"
        height="70"
        aria-hidden="true"
        style={{ display: "block" }}
      />
    </div>
  );
}
