"use client";

import { useEffect, useRef } from "react";

/** 신뢰도(0~1) 도넛 그래프. 클릭하면 등장 애니메이션을 다시 재생. */
export function ConfidenceDonut({ value, color }: { value: number; color: string }) {
  const animateRef = useRef<SVGAnimateElement | null>(null);
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const filled = (pct / 100) * circumference;
  const emptyDash = `0 ${circumference}`;
  const filledDash = `${filled} ${circumference - filled}`;

  const replay = () => {
    animateRef.current?.beginElement();
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      animateRef.current?.beginElement();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [filledDash]);

  return (
    <button
      type="button"
      className="ai-reveal-confidence-donut"
      aria-label={`승률 ${pct}% 애니메이션 다시 보기`}
      onClick={replay}
    >
      <svg viewBox="0 0 58 58" width="58" height="58" aria-hidden="true">
        <circle
          className="ai-reveal-confidence-donut-track"
          cx="29"
          cy="29"
          r={radius}
        />
        <circle
          className="ai-reveal-confidence-donut-value"
          cx="29"
          cy="29"
          r={radius}
          stroke={color}
          strokeDasharray={filledDash}
        >
          <animate
            ref={animateRef}
            attributeName="stroke-dasharray"
            from={emptyDash}
            to={filledDash}
            dur="0.9s"
            begin="indefinite"
            fill="freeze"
            calcMode="spline"
            keySplines="0.16 1 0.3 1"
          />
        </circle>
      </svg>
      <span className="ai-reveal-confidence-donut-text">{pct}%</span>
    </button>
  );
}
