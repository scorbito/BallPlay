import {
  PITCHER_CLOSER_INDEX,
  PITCHER_REQUIRED_BULLPEN_INDEX,
  PITCHER_SLOTS_COUNT,
  PITCHER_STARTER_INDEX,
  type SavedPitcherLineup
} from "@/lib/types/lineup";
import { getTeamStats } from "./statsLoader";

/** 사용자가 직접 선택한 자리는 보존하고 빈 슬롯만 자동으로 채운다.
 *  - 선발(slot 0): role="SP" 중 stamina 높은 순 (SP 없으면 stamina 1위 폴백)
 *  - 마무리(slot 1): saves 많은 순 → tiebreak stamina (역할 무관 — CL 데이터 없으므로 saves로 식별)
 *  - 불펜(slot 2~8): role="RP" 중 ERA 낮은 순 → 불펜 부족 시에만 다른 역할 폴백 (현실성: SP가 불펜 안 들어가도록)
 *  - 이미 어딘가에 배치된 선수는 다시 안 씀(중복 방지).
 *  - validIds 가 주어지면 그 ID 집합(보통 로스터)에 있는 선수만 후보로 사용. 로스터엔 없고 stats에만 있는
 *    "stale" 선수가 슬롯에 채워져 UI에서 "(자동)" placeholder 로 보이는 문제 방지. 주어지지 않으면 기존
 *    동작 유지(하위호환). */
export function fillMissingPitcherSlots(
  teamId: string,
  current: (string | null)[],
  validIds?: Set<string>
): SavedPitcherLineup | null {
  const stats = getTeamStats(teamId);
  // validIds 가 주어지면 로스터 교집합만 후보 풀로. 주어지지 않으면 기존 동작 유지(하위호환).
  const pool = validIds
    ? stats.pitchers.filter((p) => validIds.has(p.playerId))
    : stats.pitchers;
  if (pool.length < 1) return null;

  const slots = Array.from({ length: PITCHER_SLOTS_COUNT }, (_, i) => current[i] ?? null);
  const used = new Set<string>();
  slots.forEach((id) => id && used.add(id));

  // 선발 자리 — SP 역할 우선, 없으면 stamina 1위로 폴백
  if (!slots[PITCHER_STARTER_INDEX]) {
    const byStamina = (list: typeof pool) =>
      [...list].sort((a, b) => b.staminaPitches - a.staminaPitches)[0];
    const starterPick =
      byStamina(pool.filter((p) => p.role === "SP" && !used.has(p.playerId))) ??
      byStamina(pool.filter((p) => !used.has(p.playerId)));
    if (starterPick) {
      slots[PITCHER_STARTER_INDEX] = starterPick.playerId;
      used.add(starterPick.playerId);
    }
  }

  // 마무리 자리 — saves 많은 순 (역할 무관)
  if (!slots[PITCHER_CLOSER_INDEX]) {
    const closerPick = [...pool]
      .filter((p) => !used.has(p.playerId))
      .sort((a, b) => {
        if (b.saves !== a.saves) return b.saves - a.saves;
        return b.staminaPitches - a.staminaPitches;
      })[0];
    if (closerPick) {
      slots[PITCHER_CLOSER_INDEX] = closerPick.playerId;
      used.add(closerPick.playerId);
    }
  }

  // 불펜 자리 — RP만 ERA 낮은 순. RP 모자랄 때만 다른 역할 폴백.
  const byEra = (list: typeof pool) =>
    [...list].sort((a, b) => {
      const ea = a.era || 99;
      const eb = b.era || 99;
      if (ea !== eb) return ea - eb;
      return (a.whip || 99) - (b.whip || 99);
    });
  const rpPool = byEra(pool.filter((p) => p.role === "RP" && !used.has(p.playerId)));
  let rpIdx = 0;
  for (let slot = PITCHER_REQUIRED_BULLPEN_INDEX; slot < PITCHER_SLOTS_COUNT; slot += 1) {
    if (slots[slot]) continue;
    const pitcher = rpPool[rpIdx];
    if (!pitcher) break;
    slots[slot] = pitcher.playerId;
    used.add(pitcher.playerId);
    rpIdx += 1;
  }
  // RP가 부족해 빈 슬롯이 남으면 그 때만 나머지 투수로 폴백 (현실엔 거의 없음)
  const fallbackPool = byEra(pool.filter((p) => !used.has(p.playerId)));
  let fbIdx = 0;
  for (let slot = PITCHER_REQUIRED_BULLPEN_INDEX; slot < PITCHER_SLOTS_COUNT; slot += 1) {
    if (slots[slot]) continue;
    const pitcher = fallbackPool[fbIdx];
    if (!pitcher) break;
    slots[slot] = pitcher.playerId;
    used.add(pitcher.playerId);
    fbIdx += 1;
  }

  return {
    teamId,
    slots,
    updatedAt: new Date().toISOString()
  };
}

export function autoFillPitcherLineup(
  teamId: string,
  validIds?: Set<string>
): SavedPitcherLineup | null {
  // 빈 슬롯 배열을 fillMissingPitcherSlots 에 위임 — 단일 로직으로 통일.
  // (이전엔 별도 구현이라 SP 역할 필터링 누락 우려가 있었음.)
  return fillMissingPitcherSlots(
    teamId,
    Array.from({ length: PITCHER_SLOTS_COUNT }, () => null),
    validIds
  );
}
