// 팀 전력비교(/compare) 전용 — 라인업/선발/불펜 스탯을 0~100 전력지수로 환산.
// "스탯 종합 지수형(B안)": 시뮬 엔진을 돌리지 않고 지표를 가중합해 즉산한다.
// 선수 교체 시 클라이언트에서 즉시 재계산되므로 순수 함수로만 구성.

import type { SimBatter, SimPitcher } from "@/lib/sim/types";

// 리그 평균 기준선 (2026 KBO 근사). 각 지표를 이 값 기준 50점으로 스케일.
const LEAGUE = {
  OPS: 0.740, // OBP(.345) + SLG(.395)
  ERA: 4.50,
} as const;

// ERA 회귀 상수 — 이닝이 적은 투수(신인/부상 복귀)는 극단값이 나오므로
// 리그평균 쪽으로 IP 가중 회귀시켜 안정화. REG이닝만큼 리그평균을 섞는다.
const ERA_REGRESSION_IP = 25;

const clamp = (v: number, min = 1, max = 99) => Math.max(min, Math.min(max, v));

/** 이닝 가중 회귀 ERA — 표본이 적을수록 리그평균에 수렴. */
function regressedEra(era: number, ip: number): number {
  if (!Number.isFinite(era) || ip <= 0) return LEAGUE.ERA;
  return (era * ip + LEAGUE.ERA * ERA_REGRESSION_IP) / (ip + ERA_REGRESSION_IP);
}

/** 타선 점수 — 라인업 타자들의 평균 OPS 기준. .040 OPS ≈ 10점. */
export function offenseScore(batters: SimBatter[]): { score: number; ops: number } {
  const valid = batters.filter(Boolean);
  if (valid.length === 0) return { score: 50, ops: LEAGUE.OPS };
  const ops = valid.reduce((sum, b) => sum + (b.obp + b.slg), 0) / valid.length;
  const score = clamp(50 + ((ops - LEAGUE.OPS) / 0.040) * 10);
  return { score: Math.round(score), ops: Number(ops.toFixed(3)) };
}

/** 선발 점수 — 회귀 ERA 기준. 0.50 ERA ≈ 8점. */
export function starterScore(starter: SimPitcher | null): { score: number; era: number } {
  if (!starter) return { score: 50, era: LEAGUE.ERA };
  const era = regressedEra(starter.era, starter.ip);
  const score = clamp(50 + ((LEAGUE.ERA - era) / 0.50) * 8);
  return { score: Math.round(score), era: Number(era.toFixed(2)) };
}

/** 불펜 점수 — role=RP/CL 투수들의 IP 가중 회귀 ERA 기준. */
export function bullpenScore(pitchers: SimPitcher[]): { score: number; era: number } {
  const relievers = pitchers.filter((p) => p.role === "RP" || p.role === "CL");
  const pool = relievers.length > 0 ? relievers : pitchers;
  let totalIp = 0;
  let totalEr = 0;
  for (const p of pool) {
    totalIp += p.ip;
    totalEr += p.earnedRuns;
  }
  const rawEra = totalIp > 0 ? (totalEr * 9) / totalIp : LEAGUE.ERA;
  const era = regressedEra(rawEra, totalIp);
  const score = clamp(50 + ((LEAGUE.ERA - era) / 0.50) * 8);
  return { score: Math.round(score), era: Number(era.toFixed(2)) };
}

/** 최근폼 점수 — 최근 10경기 승률 기준. 승률 .500이 50점, ±.100당 ±4점. */
export function formScore(form: Array<"W" | "L" | "D">): { score: number; winPct: number } {
  const w = form.filter((r) => r === "W").length;
  const l = form.filter((r) => r === "L").length;
  const decided = w + l;
  const winPct = decided > 0 ? w / decided : 0.5;
  const score = clamp(50 + (winPct - 0.5) * 40, 20, 80);
  return { score: Math.round(score), winPct: Number(winPct.toFixed(3)) };
}

export type PowerBreakdown = {
  total: number;
  offense: number;
  starter: number;
  bullpen: number;
  form: number;
  teamOps: number;
  starterEra: number;
  bullpenEra: number;
};

// 종합 가중치 — 타선 40 / 선발 30 / 불펜 20 / 최근폼 10.
const WEIGHTS = { offense: 0.4, starter: 0.3, bullpen: 0.2, form: 0.1 } as const;

/** 전력지수 종합 — 각 요소 점수의 가중합. */
export function computePowerIndex(input: {
  batters: SimBatter[];
  starter: SimPitcher | null;
  bullpen: SimPitcher[];
  form: Array<"W" | "L" | "D">;
}): PowerBreakdown {
  const off = offenseScore(input.batters);
  const sp = starterScore(input.starter);
  const bp = bullpenScore(input.bullpen);
  const fm = formScore(input.form);

  const total = clamp(
    Math.round(
      off.score * WEIGHTS.offense +
        sp.score * WEIGHTS.starter +
        bp.score * WEIGHTS.bullpen +
        fm.score * WEIGHTS.form
    )
  );

  return {
    total,
    offense: off.score,
    starter: sp.score,
    bullpen: bp.score,
    form: fm.score,
    teamOps: off.ops,
    starterEra: sp.era,
    bullpenEra: bp.era,
  };
}
