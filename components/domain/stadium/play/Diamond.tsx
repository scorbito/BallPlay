import type { BaseState } from "@/lib/sim/types";

// 다이아몬드 컴포넌트 — 1·2·3루 점등 + 홈베이스
export function Diamond({ base }: { base: BaseState }) {
  return (
    <div className="stadium-diamond" aria-label="베이스 상황">
      <div className={`stadium-base stadium-base-2nd ${base.second ? "is-on" : ""}`} />
      <div className={`stadium-base stadium-base-3rd ${base.third ? "is-on" : ""}`} />
      <div className={`stadium-base stadium-base-1st ${base.first ? "is-on" : ""}`} />
      <div className="stadium-base stadium-base-home" />
    </div>
  );
}

export function OutDots({ outs }: { outs: 0 | 1 | 2 | 3 }) {
  return (
    <div className="stadium-outs" aria-label={`아웃 ${outs}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < outs ? "is-out" : ""} />
      ))}
    </div>
  );
}
