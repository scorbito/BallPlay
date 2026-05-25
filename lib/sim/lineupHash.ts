// 라인업 hash — 본인 중복 등록 방지용.
// 같은 hash = 같은 라인업으로 간주 (타순 9 + 투수 9 + 각 슬롯의 position).
// 다른 사람이 동일 hash를 등록하는 건 허용 — 시스템상 자연스러운 현상.

import type { SavedLineup, SavedPitcherLineup } from "@/lib/types/lineup";

/** 작은 단방향 hash. 라인업 일치성 검증용이라 충돌 가능성 무시. */
function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/**
 * 같은 9명 타순 + 9명 투수 슬롯 + 포지션이 완전히 같으면 같은 hash.
 * - 타순: order 1~9 순서대로 [playerId:position] 직렬화
 * - 투수: slot 0~8 순서대로 [playerId 또는 null] 직렬화
 * - teamId 도 포함 — 다른 팀이면 무조건 다른 라인업
 */
export function computeLineupHash(
  teamId: string,
  batting: SavedLineup,
  pitching: SavedPitcherLineup | null
): string {
  const battingPart = [...batting.slots]
    .sort((a, b) => a.order - b.order)
    .map((s) => `${s.order}:${s.playerId}:${s.position}`)
    .join("|");
  const pitchingPart = pitching
    ? pitching.slots.map((id, idx) => `${idx}:${id ?? "_"}`).join("|")
    : "no-pitcher";
  const useDhPart = batting.useDH ? "dh" : "nodh";
  return djb2(`${teamId}::${useDhPart}::${battingPart}::${pitchingPart}`);
}
