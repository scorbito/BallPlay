"use client";

import { useEffect, type CSSProperties } from "react";

// 삼진 K 효과 — 중계 텍스트(narration) 위치에 큰 빨간 K 가 슬램.
export function StrikeoutEffect({
  centerX,
  centerY,
  durationMs,
  onEnd
}: {
  centerX: number;
  centerY: number;
  durationMs: number;
  onEnd: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onEnd, durationMs + 100);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style: CSSProperties = {
    left: `${centerX}px`,
    top: `${centerY}px`,
    animationName: "stadium-strikeout-slam",
    animationDuration: `${durationMs}ms`,
    animationTimingFunction: "linear",
    animationFillMode: "forwards"
  };
  return (
    <span className="stadium-strikeout-k" style={style} onAnimationEnd={onEnd}>K</span>
  );
}
