"use client";

import { useEffect, type CSSProperties } from "react";

// 안타 발사 이펙트 — fromX,fromY 에서 dx,dy 방향으로 durationMs 동안 날아가는 공.
// CSS variable 로 좌표 전달, transition end 시 부모가 setFlyingBall(null) 로 제거.
export function FlyingBall({
  fromX,
  fromY,
  dx,
  dy,
  durationMs,
  maxScale,
  onEnd
}: {
  fromX: number;
  fromY: number;
  dx: number;
  dy: number;
  durationMs: number;
  maxScale: number;
  onEnd: () => void;
}) {
  // animation 안 도는 케이스 대비 — 명시적 timeout 으로 onEnd 보장.
  useEffect(() => {
    const t = window.setTimeout(onEnd, durationMs + 100);
    console.log("[ball] mount", { fromX, fromY, dx, dy, durationMs, maxScale });
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style: CSSProperties = {
    left: `${fromX}px`,
    top: `${fromY}px`,
    // CSS variable — keyframes 에서 --ball-dx / --ball-dy / --ball-max-scale 로 읽음.
    ["--ball-dx" as string]: `${dx}px`,
    ["--ball-dy" as string]: `${dy}px`,
    ["--ball-max-scale" as string]: String(maxScale),
    // longhand 로 명확하게 — shorthand 가 다른 CSS 와 충돌하는 경우 회피.
    animationName: "stadium-ball-fly",
    animationDuration: `${durationMs}ms`,
    // linear — keyframes 의 % 단계가 그대로 시간에 대응. 천천히 시작/가속이 keyframes 로직에 위임.
    animationTimingFunction: "linear",
    animationFillMode: "forwards"
  };
  return (
    <div
      className="stadium-flying-ball"
      style={style}
      onAnimationEnd={() => {
        console.log("[ball] animation end");
        onEnd();
      }}
    >
      {/* 야구공 SVG — 흰 배경 + 빨간 stitching 두 곡선 (dashed) */}
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#475569" strokeWidth="0.6" />
        <path
          d="M6 5.5 C 7.3 7.5, 8 9.7, 8 12 S 7.3 16.5, 6 18.5"
          fill="none"
          stroke="#dc2626"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeDasharray="1.6 1.6"
        />
        <path
          d="M18 5.5 C 16.7 7.5, 16 9.7, 16 12 S 16.7 16.5, 18 18.5"
          fill="none"
          stroke="#dc2626"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeDasharray="1.6 1.6"
        />
      </svg>
    </div>
  );
}
