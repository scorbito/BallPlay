// 양쪽 팀이 같은 KBO 팀일 때 (예: 두산 vs 두산) playerId가 겹치는 문제 해결.
//
// 우리 시스템 playerId는 `{teamId}-{jerseyNumber}` 형식 (예: "doosan-24"). 같은 팀을
// 양쪽이 고르면 시뮬 엔진의 Map/Record (pitcher lookup, boxScore, MVP 등)에서 키 충돌.
//
// 해결: 시뮬 입력으로 들어가기 직전에 home은 "H:" / away는 "A:" prefix를 모든 playerId에
// 적용. 시뮬 내부 키는 모두 prefix된 ID. 사용자에겐 항상 `.name`으로만 표시되므로 비가시.
//
// idempotent — 이미 prefix가 있으면 그대로 둠. PlayScreen이 saveMatchSession 결과를
// 다시 저장하는 경우 등에 안전.

import type { SimGameInput, SimTeamInput } from "./types";

const HOME_PREFIX = "H:";
const AWAY_PREFIX = "A:";

function isAlreadyNamespaced(team: SimTeamInput): boolean {
  const first = team.batters[0]?.playerId ?? team.starter?.playerId ?? "";
  return first.startsWith(HOME_PREFIX) || first.startsWith(AWAY_PREFIX);
}

function applySidePrefix(team: SimTeamInput, side: "home" | "away"): SimTeamInput {
  if (isAlreadyNamespaced(team)) return team;
  const prefix = side === "home" ? HOME_PREFIX : AWAY_PREFIX;
  return {
    ...team,
    batters: team.batters.map((b) => ({ ...b, playerId: prefix + b.playerId })),
    starter: { ...team.starter, playerId: prefix + team.starter.playerId },
    bullpen: team.bullpen.map((p) => ({ ...p, playerId: prefix + p.playerId }))
  };
}

export function ensureNamespacedInput(input: SimGameInput): SimGameInput {
  return {
    ...input,
    home: applySidePrefix(input.home, "home"),
    away: applySidePrefix(input.away, "away")
  };
}
