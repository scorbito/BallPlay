// AI 자동 타순 생성기 — 라인업이 없는 사용자가 즉석으로 체험할 수 있도록
// 로스터 + 시즌 스탯을 기반으로 9명 타순을 자동 구성한다.
//
// 정책:
// - P(투수)는 제외 (투수 라인업은 autoFillPitcherLineup이 따로 처리)
// - 후보 풀: 로스터에서 P가 아니고, 시드 stats에 등록된 선수.
//   stats에 없으면 leagueAverage로 보강된 fallback이 들어가긴 하지만 우선순위는 낮춤.
// - 정렬: OPS(있으면) → PA → seasonGames 내림차순. 출장 많은 주전급 우선.
// - 포지션 배분: getFallbackOrder를 이용해 중복 없이 자동 분배. 9명째는 DH 폴백.

import { getRoster } from "@/lib/rosters";
import { getTeamStats } from "./statsLoader";
import { getFallbackOrder } from "@/lib/lineup/swapHelpers";
import type {
  LineupOrder,
  LineupSlot,
  Position,
  SavedLineup
} from "@/lib/types/lineup";

type Candidate = {
  playerId: string;
  primaryPosition: Position;
  rank: number; // 낮을수록 우선
};

export function autoFillBattingLineup(teamId: string): SavedLineup | null {
  const roster = getRoster(teamId);
  if (roster.length < 9) return null;

  const stats = getTeamStats(teamId);
  const batterStatsById = new Map(stats.batters.map((b) => [b.playerId, b]));

  // P 제외 후보. stats에 있으면 OPS/PA 기반 점수, 없으면 seasonGames 폴백.
  const candidates: Candidate[] = roster
    .filter((p) => p.primaryPosition !== "P")
    .map((p) => {
      const s = batterStatsById.get(p.id);
      // 점수가 클수록 좋다 → rank는 -score 로 변환해 정렬 시 내림차순 효과.
      let score = 0;
      if (s) {
        const ops = (s.obp ?? 0) + (s.slg ?? 0);
        score = ops * 1000 + (s.pa ?? 0);
      } else {
        score = (p.seasonGames ?? 0) * 0.1; // stats 없는 선수는 후순위
      }
      return {
        playerId: p.id,
        primaryPosition: p.primaryPosition,
        rank: -score
      };
    })
    .sort((a, b) => a.rank - b.rank);

  if (candidates.length < 9) return null;

  // 포지션 배분 — 빈 포지션 순서대로 배치.
  const usedPositions = new Set<Position>();
  const slots: LineupSlot[] = [];
  let order = 1;

  for (const c of candidates) {
    if (slots.length >= 9) break;
    const fallback = getFallbackOrder(c.primaryPosition);
    const assigned: Position | undefined = usedPositions.has(c.primaryPosition)
      ? fallback.find((p) => !usedPositions.has(p))
      : c.primaryPosition;
    // 만약 모든 폴백도 차있으면(드물지만), DH가 비어있으면 DH로, 아니면 스킵.
    const finalPos: Position | null = assigned
      ? assigned
      : !usedPositions.has("DH")
      ? "DH"
      : null;
    if (!finalPos) continue;

    usedPositions.add(finalPos);
    slots.push({
      order: order as LineupOrder,
      playerId: c.playerId,
      position: finalPos
    });
    order += 1;
  }

  if (slots.length !== 9) return null;

  return {
    teamId,
    slots,
    useDH: true,
    updatedAt: new Date().toISOString()
  };
}
