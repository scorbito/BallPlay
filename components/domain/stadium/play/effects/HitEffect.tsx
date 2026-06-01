"use client";

import { useEffect, type CSSProperties } from "react";

// 안타/홈런 시 화면 위로 폭죽·반짝이 이펙트. key prop으로 매 타석마다 재실행.
export function HitEffect({ kind }: { kind: "hr" | "hit" }) {
  const particles = kind === "hr" ? 24 : 12;
  return (
    <div className={`stadium-fx stadium-fx-${kind}`} aria-hidden>
      {kind === "hr" ? <div className="stadium-fx-burst" /> : null}
      {Array.from({ length: particles }).map((_, i) => (
        <span
          key={i}
          className="stadium-fx-particle"
          style={{
            // 균등 분포 + 약간의 랜덤 — i 기반이라 결정적
            ["--angle" as string]: `${(360 / particles) * i + (i % 3) * 7}deg`,
            ["--delay" as string]: `${(i % 6) * 30}ms`,
            ["--dist" as string]: `${kind === "hr" ? 160 + (i % 5) * 20 : 90 + (i % 4) * 15}px`,
            ["--hue" as string]: `${(i * 47) % 360}`
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

// 안타/홈런/타점 이펙트 portal — 타자 row 위치(centerX, centerY) 에 폭죽.
// HitEffect 자체는 이미 absolute 기준 자식이라 fixed wrapper 안에 배치.
export function HitEffectAtPosition({
  centerX,
  centerY,
  kind,
  onEnd
}: {
  centerX: number;
  centerY: number;
  kind: "hit" | "hr";
  onEnd: () => void;
}) {
  // particle animation 이 약 900ms 안에 끝남 — 안전한 fallback timer.
  useEffect(() => {
    const t = window.setTimeout(onEnd, 1200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    // phone-frame-light 클래스 — 기존 .stadium-fx CSS 가 모두 .phone-frame-light prefix 라
    // portal 로 body 에 띄울 때 부모에 명시해야 스타일 적용됨.
    <div
      className="phone-frame-light stadium-fx-portal"
      style={{ position: "fixed", left: `${centerX}px`, top: `${centerY}px`, pointerEvents: "none", zIndex: 9998 }}
    >
      <HitEffect kind={kind} />
    </div>
  );
}
