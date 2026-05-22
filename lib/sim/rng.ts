// 시드 기반 RNG. seedrandom 의존성을 추가하기 전 임시로 Mulberry32 자체구현 사용.
// docs/sim-engine-spec.md §7.2 참조.
//
// Mulberry32: 32-bit state, ~2^32 주기. 짧은 게임 시뮬에 충분.
// 결정성: 같은 seed → 같은 시퀀스. 추첨 순서가 결과를 좌우하므로 RNG 변경은 엔진 버전 bump 필요.

import type { Rng } from "./types";

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 가중치 분포에서 하나 뽑기. weights가 정규화돼있지 않아도 동작.
export function pickWeighted<T extends string>(
  weights: Record<T, number>,
  rng: Rng
): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) {
    // fallback: 첫 키 반환
    return entries[0][0];
  }
  const target = rng() * total;
  let cumulative = 0;
  for (const [key, w] of entries) {
    cumulative += w;
    if (target < cumulative) return key;
  }
  return entries[entries.length - 1][0];
}

// 단순 베르누이
export function coinFlip(prob: number, rng: Rng): boolean {
  return rng() < prob;
}
